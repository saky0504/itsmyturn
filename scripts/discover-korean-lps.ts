
import { createClient } from '@supabase/supabase-js';

import { readFileSync } from 'fs';
import { resolve } from 'path';
import fetch from 'node-fetch';

// Load environment variables
try {
    const envPath = resolve(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            if (!process.env[key.trim()]) {
                process.env[key.trim()] = value;
            }
        }
    });
} catch {
    // .env not found
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const aladinTtbKey = process.env.ALADIN_TTB_KEY;

if (!supabaseUrl || !supabaseKey || !aladinTtbKey) {
    console.error('❌ Missing environment variables (SUPABASE_URL, SUPABASE_KEY, ALADIN_TTB_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ALADIN_API_BASE = 'http://www.aladin.co.kr/ttb/api/ItemList.aspx';

// Category ID for "Music > Vinyl (LP)" in Aladin
// Note: Aladin Category IDs can change, but 2963/53440 are common for Music/LP.
// Using CID 53440 (Music > Vinyl) or generally searching "LP" in Music.
// Let's try QueryType=ItemNewAll and SearchTarget=Music with "LP" keyword logic if CID fails,
// but ItemList API requires CID for best results.
// According to docs, CID 3887 is "Music", deeper CID needed for LP.
// Let's use 2913 (Pop/Gayo) + filtering or just fetch general Music New and filter LPs.
// Better strategy: Use specific CIDs for "Gayo > LP" if possible.
// Finding standard CID: 53533 (Vinyl) is often used. Let's try broad fetch and filter.
const TARGET_CID = 53533; // Vinyl/LP

// Expanded Negative Keywords (Sync with cleanup.ts)
const NEGATIVE_KEYWORDS = [
    'cd', 'compact disc', 'poster', 'book', 'magazine',
    't-shirt', 'shirt', 'hoodie', 'apparel', 'merch', 'clothing',
    'sticker', 'patch', 'badge', 'slipmat', 'totebag',
    'cassette', 'tape', 'vhs', 'dvd', 'blu-ray',
    'frame', '액자', 'metronome', '메트로놈', 'cleaner', '클리너',
    'turntable', '턴테이블', 'needle', 'stylus', 'cartridge'
];

async function fetchAladinLPs(queryType: 'ItemNewAll' | 'Bestseller' | 'Keyword', query?: string, categoryId: string = String(TARGET_CID), page: number = 1) {
    console.log(`📡 Fetching Aladin ${queryType} ${query ? `"${query}"` : ''} (CID: ${categoryId}, Page: ${page})...`);

    const params = new URLSearchParams({
        ttbkey: aladinTtbKey!,
        QueryType: queryType,
        MaxResults: '50',
        start: String(page),
        SearchTarget: 'Music',
        CategoryId: categoryId,
        Output: 'JS', // JSON format
        Version: '20131101'
    });

    if (queryType === 'Keyword' && query) {
        params.set('Query', query);
    }

    const url = `${ALADIN_API_BASE}?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.item || !Array.isArray(data.item)) {
            // console.error('❌ Invalid Aladin response:', data); // Quiet down error logs for empty results
            return [];
        }

        return data.item;
    } catch (error) {
        console.error(`❌ Error fetching ${queryType}:`, error);
        return [];
    }
}



async function processAladinItems(items: any[]) {
    // console.log(`🔍 Processing ${items.length} items from Aladin...`);
    let addedCount = 0;

    for (const item of items) {
        // 1. Strict Filter: Title or Category must indicate LP/Vinyl
        const title = item.title || '';
        const categoryName = item.categoryName || '';

        // Normalize Check
        const lowerTitle = title.toLowerCase();
        const lowerCat = categoryName.toLowerCase();

        // A. Filter out negative keywords first
        const hasNegative = NEGATIVE_KEYWORDS.some(k => lowerTitle.includes(k) && !lowerTitle.includes('with poster') && !lowerTitle.includes('+ poster'));
        if (hasNegative) {
            // console.log(`🚫 Skipped (Negative Keyword): ${title}`);
            continue;
        }

        // B. Price Guard for Accessories (강화)
        const price = item.priceSales || item.priceStandard || 0;
        // 가격 범위 검증: 너무 저렴하면 악세서리일 가능성
        if (price < 15000) {
            continue;
        }

        // C. LP 키워드 필수 확인 (강화)
        const lpKeywords = ['lp', 'vinyl', '바이닐', '엘피', '레코드', 'record', '12"', '12인치'];
        const isStrictCategory = lowerCat.includes('vinyl') || lowerCat.includes('lp') || lowerCat.includes('records');
        const hasLPParams = lpKeywords.some(k => lowerTitle.includes(k));

        // 카테고리와 제목 모두 LP 키워드가 없으면 제외
        if (!isStrictCategory && !hasLPParams) {
            continue; // LP 키워드 필수
        }

        // 2. Map to DB Schema
        const productData = {
            title: title, // Keep original title with tags for display
            artist: item.author || 'Unknown Artist',
            description: item.description || '',
            cover: item.cover || null,
            format: 'LP',
            release_date: item.pubDate || null,
            ean: item.isbn13 || null, // Aladin often puts EAN in isbn13 field for Music
            discogs_id: `aladin-${item.itemId}`, // Virtual ID
            last_synced_at: new Date().toISOString()
        };

        if (!productData.ean) continue; // Skip if no EAN (crucial for syncing)

        // 3. Check duplicate EAN
        const { data: existing } = await supabase
            .from('lp_products')
            .select('id')
            .eq('ean', productData.ean)
            .single();

        if (existing) {
            continue;
        }

        // 4. Insert new Product
        const { data: newProduct, error } = await supabase
            .from('lp_products')
            .insert(productData)
            .select()
            .single();

        if (error || !newProduct) {
            console.error(`❌ Failed to insert ${productData.title}:`, error);
            continue;
        }

        console.log(`✅ Added new LP: ${productData.title} (${productData.ean})`);
        addedCount++;

        // 5. Add Aladin Offer Immediately
        const offerData = {
            product_id: newProduct.id,
            vendor_name: '알라딘',
            base_price: item.priceSales || item.priceStandard,
            url: item.link,
            in_stock: item.stockStatus !== '', // Aladin specific stock logic needed? Usually assume in stock if listed in New
            last_checked_at: new Date().toISOString()
        };

        await supabase.from('lp_offers').insert(offerData);
    }

    return addedCount;
}


// Main Execution Function
export async function discoverKoreanLPs() {
    console.log('🇰🇷 Starting Korean LP Discovery (Aladin)...');
    let totalAdded = 0;

    // 1. Fetch New Releases (Vinyl Specific CID) - 페이지 축소: 5페이지 → 2페이지
    console.log('📚 Fetching New Releases (Pages 1-2)...');
    for (let page = 1; page <= 2; page++) {
        const newItems = await fetchAladinLPs('ItemNewAll', undefined, String(TARGET_CID), page);
        if (!newItems || newItems.length === 0) break; // Stop if no data returned
        const count = await processAladinItems(newItems);
        totalAdded += count;
        // Do NOT break just because count is 0 (items might already exist, keep digging)
        await new Promise(r => setTimeout(r, 2000)); // Rate limit: 1초 → 2초
    }

    // 2. Fetch Bestsellers (Vinyl Specific CID) - 페이지 축소: 5페이지 → 2페이지
    console.log('🏆 Fetching Bestsellers (Pages 1-2)...');
    for (let page = 1; page <= 2; page++) {
        const bestItems = await fetchAladinLPs('Bestseller', undefined, String(TARGET_CID), page);
        if (!bestItems || bestItems.length === 0) break;
        const count = await processAladinItems(bestItems);
        totalAdded += count;
        await new Promise(r => setTimeout(r, 2000)); // Rate limit: 1초 → 2초
    }
    // Strategy A: Broad General Category "Music" (CID 3887) but we filter strictly
    // Strategy B: Specific Korean Music Categories if mapped, but "Gayo" specific CID in Vinyl might be tricky to guess.
    // Instead, let's use Keyword Search for broad terms.

    // 핵심 키워드만 사용 (8개 → 3개로 축소)
    const searchQueries = [
        '가요 LP',
        '한국 인디 LP',
        'K-Pop Vinyl'
    ];

    console.log(`🔎 Executing Keyword Search (${searchQueries.length} 핵심 키워드만)...`);

    for (const query of searchQueries) {
        const items = await fetchAladinLPs('Keyword', query); // Uses default CID 53533
        const added = await processAladinItems(items);
        totalAdded += added;

        // Rate limit 보호: 2초 딜레이
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`🎉 Discovery Complete. Added ${totalAdded} new Korean LPs.`);
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    discoverKoreanLPs();
}
