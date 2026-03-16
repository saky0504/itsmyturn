
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

// 알라딘 타이틀 정제: 마케팅 문구 제거하고 앨범명만 남기기
function cleanAladinTitle(rawTitle: string, artist: string): string {
    let title = rawTitle || '';

    // 0. 맨 앞의 [수입], [중고], [특가] 등 태그 제거
    title = title.replace(/^(\[[^\]]+\]\s*)+/, '').trim();

    // 0.5. 미디어 타입 접두어 제거 (마케팅 문구)
    // "드라마 '별에서 온 그대' O.S.T"  → "별에서 온 그대 O.S.T"
    // "영화 '해피엔드' O.S.T"           → "해피엔드 O.S.T"
    // "드라마 별에서 온 그대 O.S.T"    → "별에서 온 그대 O.S.T" (따옴표 없는 경우)
    const MEDIA_PREFIX_QUOTED = /^(?:드라마|영화|뮤지컬|애니메이션|애니|시트콤|웹드라마|웹툰|게임)\s*['''"""](.+?)['''"""]\s*/i;
    const MEDIA_PREFIX_BARE = /^(?:드라마|영화|뮤지컬|애니메이션|애니|시트콤|웹드라마|웹툰|게임)\s+/i;
    if (MEDIA_PREFIX_QUOTED.test(title)) {
        title = title.replace(MEDIA_PREFIX_QUOTED, '$1 ').trim();
    } else {
        title = title.replace(MEDIA_PREFIX_BARE, '').trim();
    }

    // 1. 아티스트 prefix 제거 (하이픈 있는 경우: "이문세 - 3집", 없는 경우: "이문세 3집")
    const artistVariants = [
        artist,
        artist.replace(/\s*\(.*?\)\s*/g, '').trim(),
        artist.replace(/\s*\[.*?\]\s*/g, '').trim(),
    ].filter((a, i, arr) => a && arr.indexOf(a) === i);

    for (const a of artistVariants) {
        const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 하이픈 포함: "이문세 - 3집"
        title = title.replace(new RegExp('^' + escaped + '\\s*-\\s*', 'i'), '').trim();
        // 하이픈 없음: "이문세 3집" (아티스트명 뒤에 공백)
        title = title.replace(new RegExp('^' + escaped + '\\s+', 'i'), '').trim();
    }

    // 2. 포맷/스펙 대괄호 제거: [180g LP], [2LP], [사인반] 등
    title = title.replace(
        /\s*\[[^\]]*(?:\d+g|\d+LP|LP|lp|Vinyl|vinyl|바이닐|엘피|Color|Colour|색|Edition|Press|Repress|Reissue|Picture|Gatefold|Disc|Disk|사인|한정|특별|일반|투명|블랙|레드|블루|그린|옐로|화이트|골드|실버|컬러|marble|marbled|splatter)[^\]]*\]/gi,
        ''
    ).trim();

    // 3. 버전 소괄호 제거: (LP Ver.), (한국대중음악상 수상) 등
    title = title.replace(
        /\s*\([^)]*(?:LP|Ver|Vinyl|한국대중음악상|올해의|수상|사인|한정|특별|초회|일반|포토|판)[^)]*\)/gi,
        ''
    ).trim();

    // 4. " - 굿즈/특전" 뒤 제거
    const goods = ['포스터', '가사지', '포토카드', '엽서', '스티커', '리플렛', '부클렛', '머그', '키링',
        '책자', '게이트폴드', '자켓', '봉투', '메시지카드', 'poster', 'photocard', 'postcard', 'sticker', 'booklet', 'lyric'];
    const goodsRe = new RegExp('\\s*-\\s+.{0,50}(?:' + goods.join('|') + ').*$', 'i');
    title = title.replace(goodsRe, '').trim();

    // 5. 잔여 정리
    title = title.replace(/^\s*-\s*/, '').trim();
    title = title.replace(/\s{2,}/g, ' ').trim();

    return title || rawTitle; // 빈 문자열이면 원본 반환
}

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



// 알라딘 ItemSearch API - 키워드로 직접 검색 (더 넓은 범위)
const ALADIN_SEARCH_BASE = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';

async function searchAladinLPs(query: string, page: number = 1) {
    console.log(`🔍 Aladin ItemSearch: "${query}" (Page: ${page})...`);

    const params = new URLSearchParams({
        ttbkey: aladinTtbKey!,
        Query: query,
        QueryType: 'Keyword',
        MaxResults: '50',
        start: String(page),
        SearchTarget: 'Music',
        Output: 'JS',
        Version: '20131101'
    });

    const url = `${ALADIN_SEARCH_BASE}?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.item || !Array.isArray(data.item)) {
            return [];
        }

        return data.item;
    } catch (error) {
        console.error(`❌ Error searching "${query}":`, error);
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

        // B. Price Guard for Accessories
        const price = item.priceSales || item.priceStandard || 0;
        // 가격 범위 검증: 악세서리(1000원 이하)는 제외, LP 가격은 제한 없음
        if (price > 0 && price < 1000) {
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

        // 2. Map to DB Schema (타이틀 정리: 마케팅 문구 제거)
        const artist = item.author || 'Unknown Artist';
        const cleanedTitle = cleanAladinTitle(title, artist);
        const productData = {
            title: cleanedTitle,
            artist: artist,
            description: item.description || '',
            cover: item.cover ? item.cover.replace('coversum', 'cover') : null,
            format: 'LP',
            release_date: item.pubDate || null,
            ean: null, // isbn13은 알라딘 내부 번호라 실제 EAN 바코드 아님
            discogs_id: `aladin-${item.itemId}`, // Virtual ID for dedup
            last_synced_at: new Date().toISOString()
        };

        // 3. Check duplicate by discogs_id (aladin itemId)
        const { data: existingById } = await supabase
            .from('lp_products')
            .select('id')
            .eq('discogs_id', productData.discogs_id)
            .maybeSingle();

        if (existingById) {
            continue;
        }

        // 3-B. 타이틀+아티스트 정규화 중복 체크
        // "3집" vs "이문세 3집" 처럼 한쪽이 아티스트명을 앞에 붙인 형태인 경우도 동일 앨범으로 판단
        const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
        const normalizedTitle = normalize(productData.title);
        const normalizedArtist = normalize(productData.artist);
        const normalizedCombined = normalizedArtist + normalizedTitle; // "이문세3집"

        const { data: allByArtist } = await supabase
            .from('lp_products')
            .select('id, title')
            .ilike('artist', productData.artist)
            .limit(200);

        const isDuplicateTitle = (allByArtist || []).some(existing => {
            const existingNorm = normalize(existing.title);
            return (
                existingNorm === normalizedTitle ||         // 완전 일치
                existingNorm === normalizedCombined ||      // "이문세3집" === DB의 "이문세3집"
                normalizedCombined === normalize(normalizedArtist + existingNorm) || // 새 것이 combined, 기존이 short
                existingNorm.startsWith(normalizedArtist) && normalize(existingNorm.slice(normalizedArtist.length)) === normalizedTitle // 기존="이문세3집", 새="3집"
            );
        });

        if (isDuplicateTitle) {
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

        console.log(`✅ Added new LP: ${productData.title} (aladin-${item.itemId})`);
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

    // 1. Fetch New Releases (Vinyl Specific CID)
    console.log('📚 Fetching New Releases (Pages 1-5)...');
    for (let page = 1; page <= 5; page++) {
        const newItems = await fetchAladinLPs('ItemNewAll', undefined, String(TARGET_CID), page);
        if (!newItems || newItems.length === 0) break;
        const count = await processAladinItems(newItems);
        totalAdded += count;
        await new Promise(r => setTimeout(r, 1500));
    }

    // 2. Fetch Bestsellers (Vinyl Specific CID)
    console.log('🏆 Fetching Bestsellers (Pages 1-5)...');
    for (let page = 1; page <= 5; page++) {
        const bestItems = await fetchAladinLPs('Bestseller', undefined, String(TARGET_CID), page);
        if (!bestItems || bestItems.length === 0) break;
        const count = await processAladinItems(bestItems);
        totalAdded += count;
        await new Promise(r => setTimeout(r, 1500));
    }
    // Strategy A: Broad General Category "Music" (CID 3887) but we filter strictly
    // Strategy B: Specific Korean Music Categories if mapped, but "Gayo" specific CID in Vinyl might be tricky to guess.
    // Instead, let's use Keyword Search for broad terms.

    // 키워드 검색 - 다양한 장르 커버
    const searchQueries = [
        '가요 LP',
        '한국 인디 LP',
        'K-Pop Vinyl',
        '국내 LP',
        '발라드 LP',
        '힙합 LP',
        '재즈 LP',
        'R&B LP',
        '록 LP',
        '인디 Vinyl',
        '한국 아이돌 LP',
        '한국 밴드 LP'
    ];

    console.log(`🔎 Executing Keyword Search (${searchQueries.length} 키워드)...`);

    for (const query of searchQueries) {
        const items = await fetchAladinLPs('Keyword', query);
        const added = await processAladinItems(items);
        totalAdded += added;

        // Rate limit 보호: 1.5초 딜레이
        await new Promise(r => setTimeout(r, 1500));
    }

    // 3. ItemSearch API로 아티스트명 직접 검색 (더 정확한 국내 앨범 발굴)
    const artistSearchTerms = [
        // 아이돌/K-Pop
        'BTS LP', '방탄소년단 LP', 'BLACKPINK LP', '블랙핑크 LP',
        'IU LP', '아이유 LP', 'EXO LP', 'SHINee LP', '샤이니 LP',
        'TWICE LP', '트와이스 LP', 'aespa LP', 'NewJeans LP', '뉴진스 LP',
        'SEVENTEEN LP', '세븐틴 LP', 'Stray Kids LP', 'NCT LP',
        'Red Velvet LP', '레드벨벳 LP', 'Girls Generation LP', '소녀시대 LP',
        // 밴드/인디
        '혁오 LP', 'Hyukoh LP', '잔나비 LP', '검정치마 LP',
        '이날치 LP', '새소년 LP', '술탄오브더디스코 LP', '쏜애플 LP',
        '실리카겔 LP', 'BIG Naughty LP', '딥플로우 LP',
        // 발라드/팝
        '이문세 LP', '조용필 LP', '나훈아 LP', '이선희 LP',
        '김광석 LP', '이승환 LP', '토이 LP', '성시경 LP',
        '임창정 LP', '박효신 LP', '이적 LP',
        // 힙합/R&B
        '빈지노 LP', '기리보이 LP', '박재범 LP', 'Jay Park LP',
        '크러쉬 LP', 'Crush LP', '딘 LP', 'DEAN LP',
        // 재즈/포크
        '장기하 LP', '요조 LP', '10cm LP', '멜로망스 LP',
    ];

    console.log(`🎤 Executing Artist Search (${artistSearchTerms.length} 검색어)...`);

    for (const term of artistSearchTerms) {
        const items = await searchAladinLPs(term);
        const added = await processAladinItems(items);
        totalAdded += added;
        if (added > 0) console.log(`   → "${term}" 에서 ${added}개 추가`);
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`🎉 Discovery Complete. Added ${totalAdded} new Korean LPs.`);
    return totalAdded;
}

// Allow direct execution
discoverKoreanLPs();
