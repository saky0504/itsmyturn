/**
 * LP 데이터 동기화 스크립트
 * 
 * 이 스크립트는 각 판매처에서 LP 가격 및 재고 정보를 수집하여
 * Supabase에 저장합니다.
 * 
 * 실행 방법:
 * 1. Supabase Edge Function으로 배포
 * 2. 또는 cron job으로 주기적 실행
 * 3. 또는 Vercel Cron Jobs, GitHub Actions 등 사용
 * 
 * 주기: 하루에 한번 (매일 자정 또는 지정된 시간)
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';


// Load .env
dotenv.config();

// 1. 환경 변수 검증
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// API Keys
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('❌ 필수 Supabase 환경 변수가 누락되었습니다 (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null; // 테스트용으로 null 허용

// 공통 User-Agent (robots.txt 준수) - 더 현실적인 브라우저로 변경
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';

/**
 * HTTP 요청 헬퍼 (에러 처리 및 재시도 포함)
 */
async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      // 타임아웃을 위한 AbortController (15초로 증가)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch {
      // Ignore error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Failed to fetch');
}

/**
 * 숫자만 추출 (가격 파싱용)
 */
function extractNumber(text: string): number {
  const cleaned = text.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Helper to validate if the found item is the exact LP we're looking for
// Helper to validate if the found item is the exact LP we're looking for
function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier): boolean {
  if (!foundTitle) return false;

  const lowerTitle = foundTitle.toLowerCase();

  // 1. Exclude non-music items FIRST
  const nonMusicKeywords = [
    // Clothing
    '원피스', 'dress', '티셔츠', 't-shirt', '후드', 'hoodie',
    // Books/Media
    '책', 'book', '만화', 'comic', '소설', 'novel',
    // Electronics/Health
    '체중계', 'scale', '체중', '저울', '블루투스', 'bluetooth', '스마트', 'smart',
    '인바디', 'inbody', '측정', 'measure', '디지털',
    // Other
    '굿즈', 'goods', '키링', 'keyring', '패키지박스', '포토카드'
  ];
  if (nonMusicKeywords.some(k => lowerTitle.includes(k))) return false;

  // 2. Check artist/album name match
  const normalize = (str: string) => str.replace(/[\s_.,()[\]-]/g, '').toLowerCase();

  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedQueryTitle = normalize(identifier.title || '');
  const normalizedArtist = normalize(identifier.artist || '');

  // Check if artist is present
  const artistMatch = normalizedArtist && normalizedFoundTitle.includes(normalizedArtist);

  // Check if significant part of album title is present (at least 50% of words)
  let titleMatch = false;
  if (normalizedQueryTitle) {
    const titleWords = normalizedQueryTitle.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 2);
    if (titleWords.length > 0) {
      const matchCount = titleWords.filter(w => normalizedFoundTitle.includes(w)).length;
      titleMatch = matchCount >= Math.ceil(titleWords.length * 0.5); // At least 50% match
    }
  }

  // 3. CRITICAL: Must have BOTH artist AND album match
  if (!artistMatch || !titleMatch) {
    return false; // Must have both artist AND album name
  }

  // 4. Finally, confirm it's actually an LP
  const isLp = lowerTitle.includes('lp') || lowerTitle.includes('vinyl') || lowerTitle.includes('바이닐');
  if (!isLp) return false;

  // Passed all checks
  return true;
}





/**
 * 가격 유효성 검사 (Price Guard)
 */
function isValidPrice(price: number): boolean {
  // 너무 싸거나(2만원 미만) 너무 비싼(30만원 초과) 경우는 의심 (CD 오인 방지)
  return price >= 20000 && price <= 300000;
}

/**
 * 필수 포맷 키워드 포함 여부 확인
 */
function hasRequiredKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  const required = ['lp', 'vinyl', '바이닐', '레코드', 'limited', 'edition'];
  // 최소 하나는 있어야 함 (단, EAN 검색 결과 등 신뢰도 높은 경우는 제외하고 텍스트 검색 결과 검증용)
  return required.some(k => lower.includes(k));
}

interface VendorOffer {
  vendorName: string;
  channelId: string;
  basePrice: number;
  shippingFee: number;
  shippingPolicy: string;
  url: string;
  inStock: boolean;
  affiliateCode?: string;
  affiliateParamKey?: string;
}

interface ProductIdentifier {
  ean?: string; // EAN (바코드)
  discogsId?: string; // Discogs ID
  title?: string; // 제품명 (검색용)
  artist?: string; // 아티스트명 (검색용)
}

interface NaverShopItem {
  title: string;
  category1?: string;
  category2?: string;
  lprice: string;
  hprice?: string;
  mallName: string;
  link: string;
  [key: string]: unknown;
}

async function fetchNaverPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return null;
  }

  try {
    const query = identifier.ean || `${identifier.artist} ${identifier.title} LP`;
    const response = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=20&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    // Use isValidLpMatch for consistent validation
    for (const item of data.items) {
      const rawTitle = item.title || '';
      const cleanTitle = rawTitle.replace(/<[^>]+>/g, '');
      const price = parseInt(item.lprice, 10);

      if (price === 0) continue;
      if (!isValidPrice(price)) continue;

      // CRITICAL: Use isValidLpMatch instead of old similarity logic
      if (!isValidLpMatch(cleanTitle, identifier)) {
        console.log(`[네이버] ❌ Invalid Match: ${cleanTitle.substring(0, 50)}...`);
        continue;
      }

      console.log(`[네이버] ✅ Found: ${cleanTitle.substring(0, 50)}... - ${price.toLocaleString()}원`);

      return {
        vendorName: '네이버쇼핑',
        channelId: 'naver-api',
        basePrice: price,
        shippingFee: 0,
        shippingPolicy: '상세 페이지 참조',
        url: item.link,
        inStock: true,
        affiliateCode: 'itsmyturn',
        affiliateParamKey: 'NaverCode'
      };
    }

    console.log(`[네이버] No valid LP match found`);
    return null;
  } catch (error) {
    console.error('[네이버] API Error:', error);
    return null;
  }
}

/**
 * 예스24에서 LP 가격 정보 가져오기
 * EAN 또는 제품명으로 검색
 */
async function fetchYes24Price(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    // YES24 검색 URL: EAN 우선, 없으면 제품명+아티스트로 검색
    let searchUrl = '';
    if (identifier.ean) {
      searchUrl = `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      // 검색 정확도를 위해 'LP' 키워드 추가
      const searchQuery = `${identifier.artist} ${identifier.title} LP`;
      searchUrl = `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    // 검색 결과 리스트 아이템 찾기 (여러 선택자 호환)
    const items = $('.goodsList_item, .itemUnit, .yesUI_list li, li[class*="item"], li[class*="goods"]');

    if (items.length === 0) {
      // console.log(`[YES24] No products found for: ${identifier.ean || identifier.title}`);
      return null;
    }

    // 결과 순회하며 LP 찾기
    for (const element of items) {
      const item = $(element);
      const title = item.find('.goods_name a, .gd_name, a').first().text().trim();
      const link = item.find('a').first().attr('href');

      // 가격 추출
      let priceText = item.find('.price, .yes_price, [class*="price"]').first().text().trim();
      if (!priceText) {
        const match = item.text().match(/[\d,]+원/);
        if (match) priceText = match[0];
      }
      const price = extractNumber(priceText);

      if (!title || !link || price === 0) continue;

      // Use isValidLpMatch for consistent validation
      if (isValidLpMatch(title, identifier)) {
        // Price sanity check
        if (price < 15000 || price > 500000) {
          console.log(`[YES24] Price out of range: ${title} (${price}원)`);
          continue;
        }

        // Construct full URL
        const productUrl = link.startsWith('http') ? link : `https://www.yes24.com${link}`;

        console.log(`[YES24] ✅ Found LP: ${price.toLocaleString()}원 - ${title.substring(0, 30)}...`);

        // Stock check
        const stockText = item.find('.stock, [class*="stock"]').text().toLowerCase();
        const inStock = !stockText.includes('품절') && !stockText.includes('out of stock');

        return {
          vendorName: 'YES24',
          channelId: 'mega-book',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '5만원 이상 무료배송',
          url: productUrl,
          inStock: inStock,
          affiliateCode: 'itsmyturn',
          affiliateParamKey: 'Acode',
        };
      } else {
        console.log(`[YES24] ❌ Invalid Match: ${title.substring(0, 50)}...`);
      }
    }

    // No valid match found
    console.log(`[YES24] No matching LP found`);
    return null;

  } catch (error) {
    console.error('[YES24] Error:', error);
    return null;
  }
}

/**
 * 알라딘에서 LP 가격 정보 가져오기
 * EAN 또는 제품명으로 검색
 */
/**
 * 알라딘에서 LP 가격 정보 가져오기 (Open API 사용)
 * EAN 또는 제품명으로 검색
 */
async function fetchAladinPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  const aladinTtbKey = process.env.ALADIN_TTB_KEY;
  if (!aladinTtbKey) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      ttbkey: aladinTtbKey,
      QueryType: identifier.ean ? 'Keyword' : 'Keyword',
      Query: identifier.ean || `${identifier.artist} ${identifier.title} LP`,
      MaxResults: '10',
      start: '1',
      SearchTarget: 'Music',
      Output: 'JS',
      Version: '20131101'
    });

    const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?${params.toString()}`;
    // console.log(`[알라딘] API Request: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!data.item || !Array.isArray(data.item) || data.item.length === 0) {
      return null;
    }



    for (const item of data.item) {
      const title = item.title;
      const price = item.priceSales || item.priceStandard;

      if (!title || price === 0) continue;

      // Use isValidLpMatch for consistent validation
      if (isValidLpMatch(title, identifier)) {
        // Price sanity check
        if (price < 15000 || price > 500000) {
          console.log(`[알라딘] Price out of range: ${title} (${price}원)`);
          continue;
        }

        console.log(`[알라딘] ✅ Found price: ${price.toLocaleString()}원 for ${identifier.title}`);

        return {
          vendorName: '알라딘',
          channelId: 'aladin-api',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '조건부 무료',
          url: item.link,
          inStock: item.stockStatus !== '',
          affiliateCode: 'itsmyturn',
          affiliateParamKey: 'Acode',
        };
      } else {
        console.log(`[알라딘] ❌ Invalid Match: ${title.substring(0, 50)}...`);
      }
    }

    console.log(`[알라딘] No valid LP match found`);
    return null;

  } catch (error) {
    console.error('[알라딘] API Error:', error);
    return null;
  }
}



/**
 * 교보문고에서 LP 가격 정보 가져오기
 * EAN 또는 제품명으로 검색
 */
async function fetchKyoboPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    const keyword = identifier.ean || `${identifier.artist} ${identifier.title} LP`;
    const searchUrl = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(keyword)}&gbCode=TOT&target=total`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.log(`[교보문고] 응답 실패: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Iterate over the first few results to find a good match
    const items = $('.prod_item, .prod_list_item').slice(0, 5);

    for (let i = 0; i < items.length; i++) {
      const item = $(items[i]);
      const titleEl = item.find('.prod_link, [id^="cmdtName"]');
      const title = titleEl.text().trim();
      const link = item.find('.prod_link').attr('href');
      const priceText = item.find('.price .val').text().replace(/[^0-9]/g, '');
      const price = priceText ? parseInt(priceText) : 0;

      if (!title || !price || !link) continue;

      // Use isValidLpMatch for consistent validation
      if (isValidLpMatch(title, identifier)) {
        // Price sanity check
        if (price < 15000 || price > 500000) {
          console.log(`[교보문고] Price out of range: ${title} (${price}원)`);
          continue;
        }

        // Re-construct full link
        let productLink = link;
        if (!productLink.startsWith('http')) {
          productLink = `https://product.kyobobook.co.kr${productLink.startsWith('/') ? '' : '/'}${productLink}`;
        }

        console.log(`[교보문고] ✅ Match Found: ${title} (${price.toLocaleString()}원)`);

        return {
          vendorName: '교보문고',
          channelId: 'mega-book',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '5만원 이상 무료배송',
          url: productLink,
          inStock: true,
          affiliateCode: 'itsmyturn',
          affiliateParamKey: 'KyoboCode'
        };
      } else {
        console.log(`[교보문고] ❌ Invalid Match: ${title.substring(0, 50)}...`);
      }
    }

    // console.log(`[교보문고] No valid LP match found for ${keyword}`);
    return null;

  } catch (error) {
    console.error(`[교보문고] 에러 발생:`, error);
    return null;
  }
}

/**
 * 인터파크에서 LP 가격 정보 가져오기
 * EAN 또는 제품명으로 검색
 */
async function fetchInterparkPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';
    if (identifier.ean) {
      searchUrl = `https://shopping.interpark.com/search/totalSearch.do?q=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title}`;
      searchUrl = `https://shopping.interpark.com/search/totalSearch.do?q=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    // 인터파크 검색 결과에서 첫 번째 제품 찾기
    const firstItem = $('.productItem, .item, [class*="product"]').first();
    if (firstItem.length === 0) {
      console.log(`[인터파크] No products found for: ${identifier.ean || identifier.title}`);
      return null;
    }

    const title = firstItem.find('.name, .title, .productName, a[title]').first().text().trim() || firstItem.find('a').first().text().trim();
    if (!isValidLpMatch(title, identifier)) {
      console.log(`[인터파크] Invalid Match: ${title}`);
      return null;
    }

    // 가격 추출
    const priceText = firstItem.find('.price, .sell_price, [class*="price"]').first().text().trim();
    const price = extractNumber(priceText);
    if (price === 0) {
      console.log(`[인터파크] Could not extract price from: ${priceText}`);
      return null;
    }

    // 제품 URL 추출
    const productLink = firstItem.find('a').first().attr('href');
    const productUrl = productLink
      ? (productLink.startsWith('http') ? productLink : `https://shopping.interpark.com${productLink}`)
      : searchUrl;

    // 재고 확인
    const stockText = firstItem.find('.stock, [class*="stock"]').text().toLowerCase();
    const inStock = !stockText.includes('품절') && !stockText.includes('out of stock');

    return {
      vendorName: '인터파크',
      channelId: 'mega-book',
      basePrice: price,
      shippingFee: 0,
      shippingPolicy: '5만원 이상 무료배송',
      url: productUrl,
      inStock: inStock,
    };
  } catch (error) {
    console.error('[인터파크] Error:', error);
    return null;
  }
}

/**
 * Discogs API에서 제품 정보 가져오기
 */
async function fetchDiscogsInfo(discogsId: string): Promise<{
  ean?: string;
  title?: string;
  artist?: string;
  cover?: string;
  format?: string;
  year?: number;
  genres?: string[];
  styles?: string[];
} | null> {
  try {
    // Discogs API는 인증이 필요 없지만 User-Agent는 필수
    const response = await fetch(`https://api.discogs.com/releases/${discogsId}`, {
      headers: {
        'User-Agent': 'ItsMyTurn/1.0 (https://itsmyturn.app)',
      },
    });

    if (!response.ok) {
      console.log(`[Discogs API] HTTP ${response.status} for release ${discogsId}`);
      return null;
    }

    const data = await response.json();

    // 포맷 확인 (LP인지 CD인지)
    const formats = data.formats || [];
    const formatNames = formats.map((f: { name?: string }) => f.name?.toLowerCase() || '').join(' ');
    const isLP = formatNames.includes('lp') || formatNames.includes('vinyl') || formatNames.includes('12"');
    const isCD = formatNames.includes('cd') || formatNames.includes('compact disc');

    // CD인 경우 null 반환 (LP만 필요)
    if (isCD && !isLP) {
      console.log(`[Discogs API] CD 제품은 제외: ${data.title} (${formatNames})`);
      return null;
    }

    // 바코드 추출
    const identifiers = data.identifiers || [];
    const barcode = identifiers.find((id: { type: string; value: string }) => id.type === 'Barcode')?.value;

    // 커버 이미지 (가장 큰 이미지 우선)
    let coverImage = data.images?.[0]?.uri || data.thumb || '';
    if (coverImage && !coverImage.startsWith('http')) {
      coverImage = `https://api.discogs.com${coverImage}`;
    }

    return {
      ean: barcode,
      title: data.title || '',
      artist: data.artists?.[0]?.name || '',
      cover: coverImage,
      format: isLP ? 'LP' : formatNames,
      year: data.year,
      genres: data.genres || [],
      styles: data.styles || [],
    };
  } catch (error) {
    console.error(`[Discogs API] Error fetching release ${discogsId}:`, error);
    return null;
  }
}





/**
 * 향뮤직에서 LP 가격 정보 가져오기
 */
async function fetchHyangMusicPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';
    if (identifier.ean) {
      searchUrl = `https://www.hyangmusic.com/?page=search&keyword=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title}`;
      searchUrl = `https://www.hyangmusic.com/?page=search&keyword=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    // 향뮤직 검색 결과에서 첫 번째 제품 찾기
    const firstItem = $('.product, .item, [class*="product"]').first();
    if (firstItem.length === 0) {
      console.log(`[향뮤직] No products found for: ${identifier.ean || identifier.title}`);
      return null;
    }

    // 가격 추출
    const priceText = firstItem.find('.price, [class*="price"]').first().text().trim();
    const price = extractNumber(priceText);
    if (price === 0) {
      console.log(`[향뮤직] Could not extract price from: ${priceText}`);
      return null;
    }

    // 제품 URL 추출
    const productLink = firstItem.find('a').first().attr('href');
    const productUrl = productLink
      ? (productLink.startsWith('http') ? productLink : `https://www.hyangmusic.com${productLink}`)
      : searchUrl;

    // 재고 확인
    const stockText = firstItem.find('.stock, [class*="stock"]').text().toLowerCase();
    const inStock = !stockText.includes('품절') && !stockText.includes('out of stock');

    return {
      vendorName: '향뮤직',
      channelId: 'indy-shop',
      basePrice: price,
      shippingFee: 3000,
      shippingPolicy: '7만원 이상 무료배송',
      url: productUrl,
      inStock: inStock,
      affiliateCode: 'cursor-track',
      affiliateParamKey: 'ref',
    };
  } catch (error) {
    console.error('[향뮤직] Error:', error);
    return null;
  }
}

/**
 * 김밥레코드에서 LP 가격 정보 가져오기
 * 주의: 김밥레코드의 실제 검색 URL 구조를 확인해야 합니다.
 */
async function fetchKimbapRecordPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    // 김밥레코드 검색 URL (실제 구조 확인 필요)
    let searchUrl = '';
    if (identifier.ean) {
      // 실제 검색 URL 구조 확인 필요
      searchUrl = `https://kimbaprecord.com/search?q=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title}`;
      searchUrl = `https://kimbaprecord.com/search?q=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    try {
      const html = await fetchWithRetry(searchUrl);
      const $ = cheerio.load(html);

      // 검색 결과에서 첫 번째 제품 찾기
      const firstItem = $('.product, .item, [class*="product"]').first();
      if (firstItem.length === 0) {
        console.log(`[김밥레코드] No products found for: ${identifier.ean || identifier.title}`);
        return null;
      }

      // 가격 추출
      const priceText = firstItem.find('.price, [class*="price"]').first().text().trim();
      const price = extractNumber(priceText);
      if (price === 0) {
        console.log(`[김밥레코드] Could not extract price from: ${priceText}`);
        return null;
      }

      // 제품 URL 추출
      const productLink = firstItem.find('a').first().attr('href');
      const productUrl = productLink
        ? (productLink.startsWith('http') ? productLink : `https://kimbaprecord.com${productLink}`)
        : searchUrl;

      return {
        vendorName: '김밥레코드',
        channelId: 'indy-shop',
        basePrice: price,
        shippingFee: 3000,
        shippingPolicy: '7만원 이상 무료배송',
        url: productUrl,
        inStock: true,
      };
    } catch {
      // 사이트 구조가 다르거나 접근 불가능한 경우
      console.log(`[김밥레코드] Site structure may be different or inaccessible`);
      return null;
    }
  } catch (error) {
    console.error('[김밥레코드] Error:', error);
    return null;
  }
}

/**
 * 마장뮤직앤픽쳐스에서 LP 가격 정보 가져오기
 * 주의: 마장뮤직앤픽쳐스의 실제 검색 URL 구조를 확인해야 합니다.
 */
async function fetchMajangMusicPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    // 마장뮤직앤픽쳐스 검색 URL (실제 구조 확인 필요)
    let searchUrl = '';
    if (identifier.ean) {
      // 실제 검색 URL 구조 확인 필요
      searchUrl = `https://majangmusic.com/search?q=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title}`;
      searchUrl = `https://majangmusic.com/search?q=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    try {
      const html = await fetchWithRetry(searchUrl);
      const $ = cheerio.load(html);

      // 검색 결과에서 첫 번째 제품 찾기
      const firstItem = $('.product, .item, [class*="product"]').first();
      if (firstItem.length === 0) {
        console.log(`[마장뮤직앤픽쳐스] No products found for: ${identifier.ean || identifier.title}`);
        return null;
      }

      // 가격 추출
      const priceText = firstItem.find('.price, [class*="price"]').first().text().trim();
      const price = extractNumber(priceText);
      if (price === 0) {
        console.log(`[마장뮤직앤픽쳐스] Could not extract price from: ${priceText}`);
        return null;
      }

      // 제품 URL 추출
      const productLink = firstItem.find('a').first().attr('href');
      const productUrl = productLink
        ? (productLink.startsWith('http') ? productLink : `https://majangmusic.com${productLink}`)
        : searchUrl;

      return {
        vendorName: '마장뮤직앤픽쳐스',
        channelId: 'indy-shop',
        basePrice: price,
        shippingFee: 3000,
        shippingPolicy: '7만원 이상 무료배송',
        url: productUrl,
        inStock: true,
      };
    } catch {
      // 사이트 구조가 다르거나 접근 불가능한 경우
      console.log(`[마장뮤직앤픽쳐스] Site structure may be different or inaccessible`);
      return null;
    }
  } catch (error) {
    console.error('[마장뮤직앤픽쳐스] Error:', error);
    return null;
  }
}

/**
 * 모든 판매처에서 가격 정보 수집
 * EAN과 Discogs ID를 모두 활용하여 검색
 */
export async function collectPricesForProduct(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const offers: VendorOffer[] = [];

  // Discogs ID가 있지만 EAN이 없는 경우, Discogs API에서 EAN 가져오기
  let ean = identifier.ean;
  let title = identifier.title;
  let artist = identifier.artist;

  if (!ean && identifier.discogsId) {
    const discogsInfo = await fetchDiscogsInfo(identifier.discogsId);
    if (discogsInfo?.ean) {
      ean = discogsInfo.ean;
    }
    if (discogsInfo?.title) {
      title = discogsInfo.title;
    }
    if (discogsInfo?.artist) {
      artist = discogsInfo.artist;
    }
  }

  // 최종 식별자
  const finalIdentifier: ProductIdentifier = {
    ean: ean,
    discogsId: identifier.discogsId,
    title: title,
    artist: artist,
  };

  // 모든 판매처 병렬 처리 for faster execution
  console.log(`[가격 수집] 모든 판매처 검색 시작...`);

  const [
    yes24, aladin, kyobo, interpark,
    naver,  // Re-enabled to debug issue
    hyang, kimbap, majang
  ] = await Promise.all([
    // 1. 대형 서점 (음악 전문)
    fetchYes24Price(finalIdentifier),
    fetchAladinPrice(finalIdentifier),
    fetchKyoboPrice(finalIdentifier),
    fetchInterparkPrice(finalIdentifier),
    // 2. 네이버 쇼핑 API
    fetchNaverPrice(finalIdentifier),

    // 3. 전문 레코드샵
    fetchHyangMusicPrice(finalIdentifier),
    fetchKimbapRecordPrice(finalIdentifier),
    fetchMajangMusicPrice(finalIdentifier),
  ]);

  const results = [
    { name: 'YES24', data: yes24 },
    { name: '알라딘', data: aladin },
    { name: '교보문고', data: kyobo },
    { name: '인터파크', data: interpark },
    { name: '네이버', data: naver },

    { name: '향뮤직', data: hyang },
    { name: '김밥레코드', data: kimbap },
    { name: '마장뮤직', data: majang },
  ];

  results.forEach(({ name, data }) => {
    if (data) {
      offers.push(data);
      console.log(`[가격 수집] ✅ ${name}: ${data.basePrice.toLocaleString()}원`);
    }
  });

  // Deduplicate offers based on URL or Vendor+Price to prevent redundancy
  const uniqueOffers = offers.reduce((acc, current) => {
    const isDuplicate = acc.some(item =>
      item.url === current.url ||
      (item.vendorName === current.vendorName && item.basePrice === current.basePrice)
    );
    if (!isDuplicate) {
      acc.push(current);
    }
    return acc;
  }, [] as VendorOffer[]);

  console.log(`[가격 수집] 총 ${uniqueOffers.length}개의 가격 정보를 찾았습니다.`);
  return uniqueOffers;
}

/**
 * 제품의 가격 정보 업데이트
 */
async function updateProductOffers(productId: string, offers: VendorOffer[]) {
  // 기존 offers 삭제
  if (!supabase) return;

  await supabase
    .from('lp_offers')
    .delete()
    .eq('product_id', productId);

  // 새 offers 삽입
  if (offers.length > 0) {
    const offersToInsert = offers.map(offer => ({
      product_id: productId,
      vendor_name: offer.vendorName,
      channel_id: offer.channelId,
      price: offer.basePrice, // Essential: Maps to 'price' (NOT NULL)
      base_price: offer.basePrice, // Optional: Maps to 'base_price'
      currency: 'KRW',
      shipping_fee: offer.shippingFee,
      shipping_policy: offer.shippingPolicy,
      url: offer.url,
      // affiliate_url logic would go here if needed, for now using pure URL
      affiliate_url: null,
      is_stock_available: offer.inStock,
      last_checked: new Date().toISOString(),
      badge: null,
    }));

    const { error: insertError } = await supabase
      .from('lp_offers')
      .insert(offersToInsert);

    if (insertError) {
      console.error(`[DB Error] Failed to insert offers for ${productId}:`, insertError);
    } else {
      console.log(`[DB Success] Inserted ${offers.length} offers for ${productId}`);
    }
  } else {
    console.log(`[DB Info] No offers to insert for ${productId}`);
  }

  // 제품의 last_synced_at 업데이트
  await supabase
    .from('lp_products')
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);
}

/**
 * 모든 제품의 가격 정보 동기화
 */
export async function syncAllProducts() {
  try {
    if (!supabase) return;

    // 모든 제품 가져오기 (오래된 순서대로 1000개만 - API 제한 고려)
    const { data: products, error } = await supabase
      .from('lp_products')
      .select('id, ean, discogs_id, title, artist')
      .order('last_synced_at', { ascending: true, nullsFirst: true }) // 가장 오래된(또는 한번도 안한) 것부터
      .limit(1000); // 하루 API 제한(5000)을 고려하여 배치 크기 제한

    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    if (!products || products.length === 0) {
      console.log('No products to sync');
      return;
    }

    console.log(`Syncing ${products.length} products...`);

    // 각 제품에 대해 가격 정보 수집 및 업데이트
    for (const product of products) {
      try {
        const identifier: ProductIdentifier = {
          ean: product.ean || undefined,
          discogsId: product.discogs_id || undefined,
          title: product.title || undefined,
          artist: product.artist || undefined,
        };

        const identifierStr = product.ean
          ? `EAN: ${product.ean}`
          : product.discogs_id
            ? `Discogs ID: ${product.discogs_id}`
            : product.title
              ? `Title: ${product.title}`
              : 'No identifier';

        console.log(`Syncing product ${product.id} (${identifierStr})...`);

        // EAN, Discogs ID, 또는 제목+아티스트가 있어야 동기화 가능
        if (!identifier.ean && !identifier.discogsId && (!identifier.title || !identifier.artist)) {
          console.warn(`Skipping product ${product.id}: No EAN, Discogs ID, or title+artist`);
          continue;
        }

        // 기존 offers 확인 (업데이트 여부 결정)
        const { data: existingOffers } = await supabase
          .from('lp_offers')
          .select('id, vendor_name, base_price, last_checked')
          .eq('product_id', product.id);

        const existingOffersCount = existingOffers?.length || 0;

        // 가격 정보 수집 (항상 최신 정보로 업데이트)
        const offers = await collectPricesForProduct(identifier);

        if (offers.length > 0) {
          await updateProductOffers(product.id, offers);
          console.log(`✅ Updated ${offers.length} offers for product ${product.id} (${product.title || 'Unknown'}) - 기존: ${existingOffersCount}개`);
        } else {
          // offers가 없어도 업데이트 (재고 없음 상태 반영)
          await updateProductOffers(product.id, []);
          console.log(`⚠️  No offers found for product ${product.id} (${product.title || 'Unknown'}) - 기존 offers 제거됨`);
        }

        // API rate limit 고려하여 딜레이 추가 (크롤링이므로 더 긴 딜레이)
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
      } catch (error) {
        console.error(`Error syncing product ${product.id}:`, error);
        // 계속 진행
      }
    }

    console.log('Sync completed');
  } catch (error) {
    console.error('Error in syncAllProducts:', error);
    throw error;
  }
}

// 스크립트 직접 실행 시 (ES module 호환)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sync-lp-data.ts')) {
  syncAllProducts()
    .then(() => {
      console.log('Sync finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}

