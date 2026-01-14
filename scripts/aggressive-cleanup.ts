/**
 * 강력한 데이터 정리 스크립트
 * 
 * 기존 부정확한 데이터를 대량으로 정리합니다.
 * 매우 엄격한 검증 기준을 적용합니다.
 * 
 * 실행: tsx scripts/aggressive-cleanup.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 없습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 문자열 정규화 (비교용)
 */
function normalize(str: string): string {
  return str.replace(/[\s_.,()[\]-]/g, '').toLowerCase();
}

/**
 * URL 검증 (매우 엄격)
 */
function isValidUrlStrict(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const lowerPath = urlObj.pathname.toLowerCase();
    const lowerHost = urlObj.hostname.toLowerCase();

    // 명시적으로 잘못된 카테고리 차단
    const invalidCategories = [
      '/book/', '/책/', '/novel/', '/소설/', '/만화/', '/comic/',
      '/clothing/', '/의류/', '/apparel/', '/fashion/', '/dress/', '/원피스/',
      '/electronics/', '/전자/', '/health/', '/건강/',
      '/scale/', '/체중계/', '/inbody/', '/인바디/', '/weight/', '/저울/',
      '/poster/', '/포스터/', '/goods/', '/굿즈/', '/merch/',
      '/cd/', '/compact-disc/', '/cassette/', '/카세트/', '/tape/',
      '/turntable/', '/턴테이블/', '/needle/', '/stylus/', '/cartridge/',
      '/t-shirt/', '/shirt/', '/hoodie/', '/후드/', '/sweatshirt/',
    ];

    const hasInvalidCategory = invalidCategories.some(cat => lowerPath.includes(cat));
    if (hasInvalidCategory) {
      return false;
    }

    // 네이버 스마트스토어는 URL만으로는 판단 어려우므로 통과
    if (lowerHost.includes('smartstore.naver.com')) {
      return true;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * LP 매칭 검증 (매우 엄격)
 */
function isValidLpMatchStrict(title: string, artist: string, foundTitle: string): boolean {
  if (!foundTitle || !title || !artist) return false;

  const lowerTitle = foundTitle.toLowerCase();
  const lowerQueryTitle = title.toLowerCase();
  const lowerArtist = artist.toLowerCase();

  // 1. CD/디지털 차단
  const digitalKeywords = [
    'cd', 'compact disc', '디지털', 'digital', 'mp3', 'flac', 'wav',
    '오디오 cd', 'audio cd', 'cd single', 'cd 싱글', 'cd 앨범'
  ];
  if (digitalKeywords.some(k => lowerTitle.includes(k) && !lowerTitle.includes('lp') && !lowerTitle.includes('vinyl'))) {
    return false;
  }

  // 2. 포스터/굿즈 차단
  const nonMusicKeywords = [
    '원피스', 'dress', '티셔츠', 't-shirt', 'shirt', '후드', 'hoodie',
    '책', 'book', '만화', 'comic', '소설', 'novel',
    '체중계', 'scale', '저울', '인바디', 'inbody',
    '굿즈', 'goods', 'merch', 'poster', '포스터',
    'cassette', 'tape', '카세트',
    'turntable', '턴테이블', 'needle', 'stylus', 'cartridge',
  ];
  if (nonMusicKeywords.some(k => lowerTitle.includes(k))) {
    return false;
  }

  // 3. LP 키워드 필수
  const lpKeywords = ['lp', 'vinyl', '바이닐', '엘피', '레코드', 'record', '12"', '12인치'];
  if (!lpKeywords.some(k => lowerTitle.includes(k))) {
    return false;
  }

  // 4. 아티스트명 정확 매칭 (필수)
  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedArtist = normalize(artist);
  const normalizedQueryTitle = normalize(title);

  if (normalizedArtist.length < 2) return false;
  if (!normalizedFoundTitle.includes(normalizedArtist)) {
    return false;
  }

  // 5. 앨범명 95% 이상 매칭 (필수)
  const titleWords = normalizedQueryTitle.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 2);
  if (titleWords.length > 0) {
    const matchCount = titleWords.filter(w => normalizedFoundTitle.includes(w)).length;
    const matchRatio = matchCount / titleWords.length;
    if (matchRatio < 0.95) {
      return false;
    }
  } else {
    if (!normalizedFoundTitle.includes(normalizedQueryTitle)) {
      return false;
    }
  }

  return true;
}

/**
 * 1. 부정확한 offers 제거 (매우 엄격한 검증)
 */
async function cleanupInaccurateOffers() {
  console.log('🧹 [1/5] 부정확한 offers 제거 중...');

  const { data: offers, error } = await supabase
    .from('lp_offers')
    .select('id, url, base_price, product_id, lp_products(title, artist)');

  if (error) {
    console.error('❌ Failed to fetch offers:', error);
    return;
  }

  if (!offers || offers.length === 0) {
    console.log('✨ No offers to check.');
    return;
  }

  const toDelete: string[] = [];

  for (const offer of offers) {
    // URL 검증
    if (!offer.url || !isValidUrlStrict(offer.url)) {
      toDelete.push(offer.id);
      continue;
    }

    // 가격 검증
    if (offer.base_price < 20000 || offer.base_price > 1000000) {
      toDelete.push(offer.id);
      continue;
    }

    // 제품 정보가 있으면 매칭 검증
    const product = offer.lp_products as any;
    if (product && product.title && product.artist) {
      // URL에서 제품명 추출이 어려우므로, 제품 정보 기반으로만 검증
      // 실제로는 offers 테이블에 제품명이 없으므로 이 검증은 스킵
    }
  }

  if (toDelete.length > 0) {
    console.log(`📋 Found ${toDelete.length} inaccurate offers to delete.`);

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
  } else {
    console.log('✨ No inaccurate offers found.');
  }
}

/**
 * 2. 부정확한 products 제거 (매우 엄격한 검증)
 */
async function cleanupInaccurateProducts() {
  console.log('🧹 [2/5] 부정확한 products 제거 중...');

  const { data: products, error } = await supabase
    .from('lp_products')
    .select('id, title, artist, format');

  if (error) {
    console.error('❌ Failed to fetch products:', error);
    return;
  }

  if (!products || products.length === 0) {
    console.log('✨ No products to check.');
    return;
  }

  const toDelete: string[] = [];

  for (const product of products) {
    // 제목/아티스트 필수
    if (!product.title || !product.artist) {
      toDelete.push(product.id);
      continue;
    }

    const lowerTitle = (product.title || '').toLowerCase();
    const formats = (typeof product.format === 'string' 
      ? product.format.split(',') 
      : (Array.isArray(product.format) ? product.format : [])).map((f: string) => f.trim().toLowerCase());

    // CD/디지털 키워드 차단
    const invalidKeywords = [
      'cd', 'compact disc', 'poster', 'book', 'magazine',
      't-shirt', 'shirt', 'hoodie', 'apparel', 'merch',
      'cassette', 'tape', 'vhs', 'dvd', 'blu-ray',
      'turntable', '턴테이블', 'needle', 'stylus', 'cartridge',
    ];

    const hasInvalidKeyword = invalidKeywords.some(k => 
      lowerTitle.includes(k) && !lowerTitle.includes('with poster') && !lowerTitle.includes('+ poster')
    );

    // 포맷 검증
    const hasInvalidFormat = formats.some((f: string) => 
      invalidKeywords.some(k => f.includes(k))
    );

    // LP 포맷 필수
    const isVinyl = formats.some((f: string) => 
      f.includes('vinyl') || f.includes('lp') || f.includes('12"')
    );

    if (hasInvalidKeyword || hasInvalidFormat || (formats.length > 0 && !isVinyl)) {
      toDelete.push(product.id);
      continue;
    }

    // 아티스트명이 제목에 포함되어야 함
    const normalizedTitle = normalize(product.title);
    const normalizedArtist = normalize(product.artist);
    if (normalizedArtist.length > 2 && !normalizedTitle.includes(normalizedArtist)) {
      toDelete.push(product.id);
      continue;
    }
  }

  if (toDelete.length > 0) {
    console.log(`📋 Found ${toDelete.length} inaccurate products to delete.`);

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
  } else {
    console.log('✨ No inaccurate products found.');
  }
}

/**
 * 3. 중복 offers 제거
 */
async function cleanupDuplicateOffers() {
  console.log('🧹 [3/5] 중복 offers 제거 중...');

  const { data: offers, error } = await supabase
    .from('lp_offers')
    .select('id, product_id, url, created_at')
    .order('created_at', { ascending: true });

  if (error || !offers) {
    console.error('❌ Failed to fetch offers:', error);
    return;
  }

  const normalizeUrl = (url: string | null): string => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
    } catch {
      return url.trim().toLowerCase();
    }
  };

  const uniqueMap = new Map<string, string>();
  const toDelete: string[] = [];

  for (const offer of offers) {
    if (!offer.url || !offer.product_id) {
      toDelete.push(offer.id);
      continue;
    }

    const normalizedUrl = normalizeUrl(offer.url);
    const key = `${offer.product_id}|${normalizedUrl}`;

    if (uniqueMap.has(key)) {
      toDelete.push(offer.id);
    } else {
      uniqueMap.set(key, offer.id);
    }
  }

  if (toDelete.length > 0) {
    console.log(`📋 Found ${toDelete.length} duplicate offers to delete.`);

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
  } else {
    console.log('✨ No duplicate offers found.');
  }
}

/**
 * 4. 비정상 가격 offers 제거
 */
async function cleanupBadPrices() {
  console.log('🧹 [4/5] 비정상 가격 offers 제거 중...');

  const { data: offers, error } = await supabase
    .from('lp_offers')
    .select('id, base_price')
    .or('base_price.lt.20000,base_price.gt.1000000');

  if (error) {
    console.error('❌ Failed to fetch offers:', error);
    return;
  }

  if (!offers || offers.length === 0) {
    console.log('✨ No bad price offers found.');
    return;
  }

  const idsToDelete = offers.map(o => o.id);
  const batchSize = 1000;

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
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

  console.log(`✅ Deleted ${idsToDelete.length} bad price offers.`);
}

/**
 * 5. offers가 없는 products 제거 (선택사항)
 */
async function cleanupProductsWithoutOffers() {
  console.log('🧹 [5/5] offers가 없는 products 제거 중...');

  const { data: products, error } = await supabase
    .from('lp_products')
    .select('id');

  if (error || !products) {
    console.error('❌ Failed to fetch products:', error);
    return;
  }

  const { data: offers, error: offersError } = await supabase
    .from('lp_offers')
    .select('product_id');

  if (offersError) {
    console.error('❌ Failed to fetch offers:', offersError);
    return;
  }

  const productIdsWithOffers = new Set((offers || []).map((o: any) => o.product_id));
  const productsWithoutOffers = products.filter(p => !productIdsWithOffers.has(p.id));

  if (productsWithoutOffers.length > 0) {
    console.log(`📋 Found ${productsWithoutOffers.length} products without offers.`);
    console.log('⚠️  이 작업은 건너뜁니다 (offers가 없는 제품도 유지할 수 있음).');
    // 실제로 삭제하려면 아래 주석 해제
    // const idsToDelete = productsWithoutOffers.map(p => p.id);
    // await supabase.from('lp_products').delete().in('id', idsToDelete);
  } else {
    console.log('✨ All products have offers.');
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 강력한 데이터 정리 시작...\n');

  try {
    await cleanupInaccurateOffers();
    console.log('');
    await cleanupInaccurateProducts();
    console.log('');
    await cleanupDuplicateOffers();
    console.log('');
    await cleanupBadPrices();
    console.log('');
    await cleanupProductsWithoutOffers();
    console.log('');

    console.log('✅ 모든 정리 작업 완료!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
main();
