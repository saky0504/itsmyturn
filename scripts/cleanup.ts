
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables if running directly
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase environment variables missing');
    // Don't exit here if imported, but functions will fail
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

/**
 * Remove products that are not LPs (CDs, posters, merch)
 */
export async function cleanupBadProducts() {
    console.log('🧹 [Cleanup] Checking for non-LP items (Posters, Merch, etc.)...');

    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, title, format');

    if (error) {
        console.error('❌ Failed to fetch products:', error);
        return;
    }

    // Expanded Negative Keywords
    const invalidKeywords = [
        'cd', 'compact disc', 'poster', 'book', 'magazine',
        't-shirt', 'shirt', 'hoodie', 'apparel', 'merch', 'clothing',
        'sticker', 'patch', 'badge', 'slipmat', 'totebag',
        'cassette', 'tape', 'vhs', 'dvd', 'blu-ray',
        'frame', '액자', 'metronome', '메트로놈', 'cleaner', '클리너',
        'turntable', '턴테이블', 'needle', 'stylus', 'cartridge'
    ];

    const toDelete: string[] = [];

    for (const product of products) {
        const lowerTitle = (product.title || '').toLowerCase();
        const formats = (typeof product.format === 'string' ? product.format.split(',') : (Array.isArray(product.format) ? product.format : [])).map((f: string) => f.trim().toLowerCase());

        // Check title (allow "with poster" but generally strict)
        // strict exclusion if ANY invalid keyword is present as a standalone word or significant part
        const hasInvalidKeyword = invalidKeywords.some(k => lowerTitle.includes(k) && !lowerTitle.includes('with poster') && !lowerTitle.includes('+ poster'));

        // Check format
        const hasInvalidFormat = formats.some((f: string) => invalidKeywords.some(k => f.includes(k)));

        // Check if it lacks vinyl format (strict check)
        const isVinyl = formats.some((f: string) => f.includes('vinyl') || f.includes('lp') || f.includes('12"'));

        if (hasInvalidKeyword || hasInvalidFormat || (formats.length > 0 && !isVinyl)) {
            // console.log(`🗑️  Marked for deletion: ${product.title} (Format: ${product.format})`);
            toDelete.push(product.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`📋 Found ${toDelete.length} invalid products to delete.`);
        // Delete in batches
        const batchSize = 1000;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: deleteError } = await supabase
                .from('lp_products')
                .delete()
                .in('id', batch);

            if (deleteError) {
                console.error(`❌ Failed to delete batch ${i}:`, deleteError);
            }
        }
        console.log('✅ Successfully deleted bad products.');
    } else {
        console.log('✨ No bad products found.');
    }
}

/**
 * Remove offers with abnormally low prices (Accessory Check)
 */
export async function cleanupBadOffers() {
    console.log('🧹 [Cleanup] Checking for invalid low-price offers (< 15,000 KRW)...');

    // 1. Fetch all offers with price < 15000 (Raised from 10k to 15k to catch more accessories)
    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, base_price, vendor_name, url')
        .lt('base_price', 15000);

    if (error) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    if (!offers || offers.length === 0) {
        console.log('✨ No bad offers found.');
        return;
    }

    console.log(`📋 Found ${offers.length} suspicious offers.`);

    // 2. Delete them
    const idsToDelete = offers.map(o => o.id);
    const { error: deleteError } = await supabase
        .from('lp_offers')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error('❌ Failed to delete offers:', deleteError);
    } else {
        console.log(`✅ Successfully deleted ${idsToDelete.length} bad offers.`);
    }
}

/**
 * Remove duplicate offers for the same product and URL
 * 개선: URL 기반 중복 제거 (같은 제품의 같은 URL은 하나만 유지)
 */
export async function cleanupDuplicateOffers() {
    console.log('🧹 [Cleanup] Checking for duplicate offers (URL 기반)...');

    // Fetch all offers
    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, product_id, url, created_at')
        .order('created_at', { ascending: true }); // Keep oldest

    if (error || !offers) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    // URL 정규화 함수 (쿼리 파라미터 제거하여 비교)
    const normalizeUrl = (url: string | null): string => {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            // 프로토콜, 호스트, 경로만 비교 (쿼리 파라미터 제거)
            return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
        } catch {
            return url.trim().toLowerCase();
        }
    };

    const uniqueMap = new Map<string, string>(); // key: product_id|normalized_url, value: offer_id (kept)
    const toDelete: string[] = [];

    for (const offer of offers) {
        if (!offer.url || !offer.product_id) {
            // URL이나 product_id가 없으면 삭제 대상
            toDelete.push(offer.id);
            continue;
        }

        const normalizedUrl = normalizeUrl(offer.url);
        const key = `${offer.product_id}|${normalizedUrl}`;

        if (uniqueMap.has(key)) {
            // Duplicate found -> Mark for deletion (keep the first one)
            toDelete.push(offer.id);
        } else {
            // Keep this one (first occurrence)
            uniqueMap.set(key, offer.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`📋 Found ${toDelete.length} duplicate offers to delete. (${uniqueMap.size}개 유지)`);

        // Delete in batches of 1000 to be safe
        const batchSize = 1000;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: deleteError } = await supabase
                .from('lp_offers')
                .delete()
                .in('id', batch);

            if (deleteError) {
                console.error(`❌ Failed to delete batch ${i / batchSize + 1}:`, deleteError);
            } else {
                console.log(`✅ Deleted batch ${i / batchSize + 1} (${batch.length} items)`);
            }
        }
        console.log('✅ Duplicate cleanup complete.');
    } else {
        console.log('✨ No duplicate offers found.');
    }
}

/**
 * 잘못된 URL을 가진 offers 제거
 * URL에 체중계, 포스터 등 잘못된 키워드가 포함된 offer 제거
 */
export async function cleanupInvalidUrls() {
    console.log('🧹 [Cleanup] 잘못된 URL을 가진 offers 제거 중...');

    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, url');

    if (error) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    if (!offers || offers.length === 0) {
        console.log('✨ No offers to check.');
        return;
    }

    // 잘못된 URL 키워드
    const invalidUrlKeywords = [
        '체중계', 'scale', 'weight', '저울', '인바디', 'inbody',
        '원피스', 'dress', '티셔츠', 't-shirt', 'shirt', '후드', 'hoodie',
        '책', 'book', '만화', 'comic', '소설', 'novel',
        'poster', '포스터', '굿즈', 'goods', 'merch',
        'cd', 'compact-disc', '디지털', 'digital',
        'cassette', 'tape', '카세트',
        'turntable', '턴테이블', 'needle', 'stylus', 'cartridge',
    ];

    const toDelete: string[] = [];

    for (const offer of offers) {
        if (!offer.url) {
            toDelete.push(offer.id); // URL이 없으면 삭제
            continue;
        }

        const lowerUrl = offer.url.toLowerCase();
        const hasInvalidKeyword = invalidUrlKeywords.some(keyword => lowerUrl.includes(keyword));

        if (hasInvalidKeyword) {
            toDelete.push(offer.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`📋 Found ${toDelete.length} offers with invalid URLs.`);

        const batchSize = 1000;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: deleteError } = await supabase
                .from('lp_offers')
                .delete()
                .in('id', batch);

            if (deleteError) {
                console.error(`❌ Failed to delete batch ${i / batchSize + 1}:`, deleteError);
            } else {
                console.log(`✅ Deleted batch ${i / batchSize + 1} (${batch.length} items)`);
            }
        }
        console.log('✅ Invalid URLs cleanup complete.');
    } else {
        console.log('✨ No invalid URLs found.');
    }
}

/**
 * Remove products with missing title or artist
 */
export async function cleanupMissingData() {
    console.log('🧹 [Cleanup] Checking for products with missing title or artist...');

    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, title, artist')
        .or('title.is.null,artist.is.null,title.eq.,artist.eq.');

    if (error) {
        console.error('❌ Failed to fetch missing data products:', error);
        return;
    }

    if (!products || products.length === 0) {
        console.log('✨ No missing data products found.');
        return;
    }

    console.log(`📋 Found ${products.length} products with missing title or artist.`);

    const idsToDelete = products.map(p => p.id);
    const batchSize = 1000;

    for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
            .from('lp_products')
            .delete()
            .in('id', batch);

        if (deleteError) {
            console.error(`❌ Failed to delete batch ${i}:`, deleteError);
        } else {
            console.log(`✅ Deleted batch ${i / batchSize + 1} (${batch.length} items)`);
        }
    }
}

/**
 * 일괄 정리 함수: CD, 포스터, 부정확한 매칭 제거
 * 기존 부정확한 데이터를 일괄적으로 정리
 */
export async function cleanupAllInaccurateData() {
    console.log('🧹 [일괄 정리] 부정확한 데이터 일괄 정리 시작...\n');

    try {
        // 1. CD/디지털 음원 제거
        console.log('1️⃣ CD/디지털 음원 제거 중...');
        await cleanupBadProducts();
        console.log('');

        // 2. 포스터/굿즈 제거 (cleanupBadProducts에서 이미 처리됨)
        console.log('2️⃣ 포스터/굿즈 제거 완료 (cleanupBadProducts에서 처리됨)\n');

        // 3. 부정확한 매칭 제거 (아티스트/앨범명 불일치)
        console.log('3️⃣ 부정확한 매칭 제거 중...');
        await cleanupInaccurateMatches();
        console.log('');

        // 4. 중복 데이터 제거
        console.log('4️⃣ 중복 데이터 제거 중...');
        await cleanupDuplicateOffers();
        console.log('');

        // 5. 잘못된 URL 제거
        console.log('5️⃣ 잘못된 URL 제거 중...');
        await cleanupInvalidUrls();
        console.log('');

        // 6. 정보 불완전한 제품 제거
        console.log('6️⃣ 정보 불완전한 제품 제거 중...');
        await cleanupMissingData();
        console.log('');

        // 7. 비정상 가격 제거
        console.log('7️⃣ 비정상 가격 제거 중...');
        await cleanupBadOffers();
        console.log('');

        console.log('✅ 일괄 정리 완료!');
    } catch (error) {
        console.error('❌ 일괄 정리 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 부정확한 매칭 제거: 아티스트/앨범명이 제목에 포함되지 않는 제품 제거
 */
async function cleanupInaccurateMatches() {
    console.log('🧹 [Cleanup] 부정확한 매칭 제거 중...');

    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, title, artist');

    if (error) {
        console.error('❌ Failed to fetch products:', error);
        return;
    }

    if (!products || products.length === 0) {
        console.log('✨ No products to check.');
        return;
    }

    const normalize = (str: string) => str.replace(/[\s_.,()[\]-]/g, '').toLowerCase();
    const toDelete: string[] = [];

    for (const product of products) {
        if (!product.title || !product.artist) {
            continue; // 이미 cleanupMissingData에서 처리됨
        }

        const normalizedTitle = normalize(product.title);
        const normalizedArtist = normalize(product.artist);

        // 아티스트명이 제목에 포함되어 있는지 확인
        // 아티스트명이 제목에 포함되지 않으면 부정확한 매칭으로 간주
        if (normalizedArtist.length > 2 && !normalizedTitle.includes(normalizedArtist)) {
            // 제목에 아티스트명이 없으면 부정확한 매칭 가능성
            // 단, 아티스트명이 너무 짧으면 (2글자 이하) 신뢰도 낮아서 스킵
            toDelete.push(product.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`📋 Found ${toDelete.length} products with inaccurate matches.`);

        const batchSize = 1000;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: deleteError } = await supabase
                .from('lp_products')
                .delete()
                .in('id', batch);

            if (deleteError) {
                console.error(`❌ Failed to delete batch ${i / batchSize + 1}:`, deleteError);
            } else {
                console.log(`✅ Deleted batch ${i / batchSize + 1} (${batch.length} items)`);
            }
        }
        console.log('✅ Inaccurate matches cleanup complete.');
    } else {
        console.log('✨ No inaccurate matches found.');
    }
}
