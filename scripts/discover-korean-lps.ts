
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
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
} catch (error) {
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

async function fetchAladinLPs(queryType: 'ItemNewAll' | 'Bestseller') {
    console.log(`📡 Fetching Aladin ${queryType}...`);

    const params = new URLSearchParams({
        ttbkey: aladinTtbKey!,
        QueryType: queryType,
        MaxResults: '50',
        start: '1',
        SearchTarget: 'Music',
        CategoryId: String(TARGET_CID),
        Output: 'JS', // JSON format
        Version: '20131101'
    });

    const url = `${ALADIN_API_BASE}?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.item || !Array.isArray(data.item)) {
            console.error('❌ Invalid Aladin response:', data);
            return [];
        }

        return data.item;
    } catch (error) {
        console.error(`❌ Error fetching ${queryType}:`, error);
        return [];
    }
}

function normalizeTitle(title: string): string {
    // Remove tags like [LP], (180g), [Limited]
    return title
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/LP/gi, '')
        .replace(/Vinyl/gi, '')
        .trim();
}

async function processAladinItems(items: any[]) {
    console.log(`🔍 Processing ${items.length} items from Aladin...`);
    let addedCount = 0;

    for (const item of items) {
        // 1. Strict Filter: Title or Category must indicate LP/Vinyl
        const title = item.title || '';
        const categoryName = item.categoryName || '';
        const description = item.description || '';

        // Normalize Check
        const lowerTitle = title.toLowerCase();
        const lowerCat = categoryName.toLowerCase();

        const hasLPParams = lowerTitle.includes('lp') || lowerTitle.includes('vinyl') || lowerCat.includes('lp') || lowerCat.includes('vinyl');
        const isCD = lowerTitle.includes('cd') || lowerTitle.includes('compact disc') || lowerCat.includes('cd');

        if (isCD && !hasLPParams) continue; // Skip strict CDs
        if (!hasLPParams && !item.format?.toLowerCase().includes('lp')) continue; // Must have some LP indication

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
            // Product exists, link offer?
            // Skip for now, focus on new discovery
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

    // 1. Fetch New Releases
    const newItems = await fetchAladinLPs('ItemNewAll');
    const newAdded = await processAladinItems(newItems);

    // 2. Fetch Bestsellers
    const bestItems = await fetchAladinLPs('Bestseller');
    const bestAdded = await processAladinItems(bestItems);

    console.log(`🎉 Discovery Complete. Added ${newAdded + bestAdded} new Korean LPs.`);
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    discoverKoreanLPs();
}
