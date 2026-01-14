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
/**
 * URL 검증 함수: 잘못된 상품 링크 필터링
 * URL 경로와 쿼리 파라미터를 분석하여 실제 상품 카테고리를 확인
 * 앨범 제목에 키워드가 들어가 있어도 정상 LP는 통과시킴
 * 
 * 예: "The Weight" 앨범의 URL이 /music/lp/the-weight 이면 통과
 *     체중계 상품의 URL이 /health/scale/weight 이면 차단
 * 
 * 특별 처리: 네이버 스마트스토어 URL은 제품 ID만 있어서 URL 검증이 어려움
 *           따라서 제품명 검증에 의존해야 함 (이 함수는 기본 검증만 수행)
 */
function isValidUrl(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const lowerPath = urlObj.pathname.toLowerCase();
    const lowerSearch = urlObj.search.toLowerCase();
    const lowerHost = urlObj.hostname.toLowerCase();

    // 네이버 스마트스토어 URL 특별 처리
    // smartstore.naver.com/main/products/숫자 형태는 제품명 검증에 의존
    if (lowerHost.includes('smartstore.naver.com')) {
      // 네이버 스마트스토어는 URL만으로는 판단 어려우므로 기본적으로 통과
      // 제품명 검증(isValidLpMatch)에서 엄격하게 필터링됨
      // 단, 명시적으로 잘못된 패턴만 차단
      if (lowerPath.includes('/health/') || lowerPath.includes('/book/') || lowerPath.includes('/clothing/')) {
        return false;
      }
      return true; // 나머지는 제품명 검증에 의존
    }

    // URL 경로에서 카테고리 확인 (더 정확한 필터링)
    // 음악/LP 카테고리가 아닌 경우만 차단
    const musicCategories = ['/music/', '/lp/', '/vinyl/', '/record/', '/album/', '/음악/', '/레코드/', '/앨범/'];
    const isMusicCategory = musicCategories.some(cat => lowerPath.includes(cat));

    // 책/의류/전자제품 카테고리 명시적 차단
    const invalidCategories = [
      '/book/', '/책/', '/novel/', '/소설/',
      '/clothing/', '/의류/', '/apparel/', '/fashion/',
      '/electronics/', '/전자/', '/health/', '/건강/',
      '/scale/', '/체중계/', '/inbody/', '/인바디/',
      '/poster/', '/포스터/', '/goods/', '/굿즈/',
      '/cd/', '/compact-disc/', '/cassette/', '/카세트/',
      '/turntable/', '/턴테이블/', '/needle/', '/stylus/',
    ];

    // 명시적으로 잘못된 카테고리인 경우 차단
    const hasInvalidCategory = invalidCategories.some(cat => lowerPath.includes(cat));
    if (hasInvalidCategory && !isMusicCategory) {
      // 잘못된 카테고리이고 음악 카테고리가 아니면 차단
      return false;
    }

    // 쿼리 파라미터에서 카테고리 확인
    const categoryParam = urlObj.searchParams.get('category') || urlObj.searchParams.get('cat') || urlObj.searchParams.get('c');
    if (categoryParam) {
      const lowerCategory = categoryParam.toLowerCase();
      const invalidCategoryParams = ['book', '책', 'clothing', '의류', 'electronics', '전자', 'health', '건강', 'scale', '체중계'];
      if (invalidCategoryParams.some(cat => lowerCategory.includes(cat))) {
        return false;
      }
    }

    // URL에 명시적으로 잘못된 상품 타입이 포함된 경우만 차단
    // 예: /product/scale/, /item/체중계/ 등
    const explicitInvalidPatterns = [
      '/product/scale', '/item/scale', '/goods/scale',
      '/product/체중계', '/item/체중계', '/goods/체중계',
      '/product/poster', '/item/poster', '/goods/poster',
      '/product/포스터', '/item/포스터', '/goods/포스터',
      '/product/cd/', '/item/cd/', '/goods/cd/',
    ];

    if (explicitInvalidPatterns.some(pattern => lowerPath.includes(pattern))) {
      return false;
    }

    // 기본적으로 통과 (제목에 키워드가 있어도 URL 경로가 정상이면 OK)
    // 예: "The Weight" 앨범의 URL이 /music/lp/the-weight 이면 통과
    return true;

  } catch (error) {
    // URL 파싱 실패 시 기본적으로 통과 (너무 엄격하게 차단하지 않음)
    console.warn(`[URL 검증] URL 파싱 실패: ${url}`, error);
    return true;
  }
}

/**
 * LP 매칭 검증 함수 (강화된 버전)
 * 95% 이상의 정확한 매칭만 허용하여 부정확한 데이터 수집을 차단
 */
function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier): boolean {
  if (!foundTitle) return false;

  const lowerTitle = foundTitle.toLowerCase();

  // 1. CD/디지털 음원 명시적 차단 (가장 먼저 체크)
  const digitalKeywords = [
    'cd', 'compact disc', 'compact disc', '디지털', 'digital', 'mp3', 'flac', 'wav',
    '오디오 cd', 'audio cd', 'cd single', 'cd 싱글', 'cd 앨범'
  ];
  if (digitalKeywords.some(k => lowerTitle.includes(k) && !lowerTitle.includes('lp') && !lowerTitle.includes('vinyl'))) {
    return false;
  }

  // 2. 포스터/굿즈 확장된 키워드 리스트로 차단
  const nonMusicKeywords = [
    '원피스', 'dress', '티셔츠', 't-shirt', 'shirt', '후드', 'hoodie', 'sweatshirt',
    '책', 'book', '만화', 'comic', '소설', 'novel', '전집', '문고',
    '체중계', 'scale', '체중', '저울', '블루투스', 'bluetooth', '스마트', 'smart',
    '인바디', 'inbody', '측정', 'measure', '디지털',
    '굿즈', 'goods', 'merch', 'merchandise', '키링', 'keyring', '키체인', 'keychain',
    '패키지박스', '포토카드', 'photocard', '스티커', 'sticker', '패치', 'patch',
    'calendar', '달력', 'poster', '포스터', 'magazine', '잡지', 'journal',
    'cassette', 'tape', '카세트', 'vhs', 'dvd', 'blu-ray', '블루레이',
    'frame', '액자', 'metronome', '메트로놈', 'cleaner', '클리너', '청소',
    'turntable', '턴테이블', 'needle', 'stylus', 'cartridge', '카트리지', '톤암', 'tonearm'
  ];
  if (nonMusicKeywords.some(k => lowerTitle.includes(k))) {
    return false;
  }

  // 3. LP 키워드 필수 확인 (반드시 포함되어야 함)
  const lpKeywords = ['lp', 'vinyl', '바이닐', '엘피', '레코드', 'record', '12"', '12인치'];
  const hasLpKeyword = lpKeywords.some(k => lowerTitle.includes(k));
  if (!hasLpKeyword) {
    return false;
  }

  // 4. 아티스트명 및 앨범명 정확 매칭 (95% 이상)
  const normalize = (str: string) => str.replace(/[\s_.,()[\]-]/g, '').toLowerCase();

  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedQueryTitle = normalize(identifier.title || '');
  const normalizedArtist = normalize(identifier.artist || '');

  // 아티스트명: 정확히 포함되어야 함 (부분 매칭 불가 - 전체 아티스트명이 포함되어야 함)
  let artistMatch = false;
  if (normalizedArtist && normalizedArtist.length > 0) {
    // 아티스트명이 정확히 포함되어 있는지 확인
    artistMatch = normalizedFoundTitle.includes(normalizedArtist);
    
  } else {
    // 아티스트명이 없으면 매칭 실패
    return false;
  }

  // 앨범명: 95% 이상 단어 매칭 필수
  let titleMatch = false;
  if (normalizedQueryTitle && normalizedQueryTitle.length > 0) {
    const titleWords = normalizedQueryTitle.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 2);
    if (titleWords.length > 0) {
      const matchCount = titleWords.filter(w => normalizedFoundTitle.includes(w)).length;
      const matchRatio = matchCount / titleWords.length;
      // 95% 이상 매칭 필수 (0.95)
      titleMatch = matchRatio >= 0.95;
    } else {
      // 단어가 없으면 전체 문자열 매칭 확인
      titleMatch = normalizedFoundTitle.includes(normalizedQueryTitle);
    }
  } else {
    // 앨범명이 없으면 매칭 실패
    return false;
  }

  // 5. CRITICAL: 아티스트명과 앨범명 모두 정확히 매칭되어야 함
  if (!artistMatch || !titleMatch) {
    return false;
  }

  // 모든 검증 통과
  return true;
}





/**
 * 가격 유효성 검사 (Price Guard)
 */
// Price Guard - Adjusted range
function isValidPrice(price: number): boolean {
  // Too cheap (< 20,000) = Likely CD or accessory
  // Too expensive (> 1,000,000) = Likely rare or set, but safer to block for now unless Verified
  return price >= 20000 && price <= 1000000;
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
      const cleanTitle = rawTitle.replace(/<[^>]+>/g, '').trim();
      const price = parseInt(item.lprice, 10);

      if (price === 0) continue;
      if (!isValidPrice(price)) continue;

      // 제품명이 너무 짧거나 의미 없는 경우 차단
      if (cleanTitle.length < 5) {
        console.log(`[네이버] ❌ 제품명 너무 짧음: ${cleanTitle}`);
        continue;
      }

      // 제품명에 숫자만 있거나 의미 없는 경우 차단
      if (/^[\d\s\-]+$/.test(cleanTitle)) {
        console.log(`[네이버] ❌ 제품명이 숫자만: ${cleanTitle}`);
        continue;
      }

      // CRITICAL: Use isValidLpMatch instead of old similarity logic
      if (!isValidLpMatch(cleanTitle, identifier)) {
        console.log(`[네이버] ❌ Invalid Match: ${cleanTitle.substring(0, 50)}...`);
        continue;
      }

      // DOMAIN WHITELIST: Reject unknown junk stores (jajae09, partsvalley, etc)
      const allowedDomains = [
        'smartstore.naver.com',
        'brand.naver.com',
        'shopping.naver.com',
        'www.yes24.com',
        'www.aladin.co.kr',
        'www.synnara.co.kr',
        'hottracks.kyobobook.co.kr',
        'book.interpark.com',
        'shopping.interpark.com'
      ];

      // Extract domain from link
      let linkDomain = '';
      try {
        linkDomain = new URL(item.link).hostname;
      } catch (e) {
        // If invalid URL, skip
        continue;
      }

      const isAllowed = allowedDomains.some(d => linkDomain.includes(d));
      if (!isAllowed) {
        console.log(`[네이버] 🚫 Blocked Domain: ${linkDomain}`);
        continue;
      }

      // 네이버 스마트스토어 URL 추가 검증
      // smartstore.naver.com/main/products/숫자 형태는 제품명 검증이 더 중요
      if (linkDomain.includes('smartstore.naver.com')) {
        // 제품명에 아티스트와 앨범명이 모두 포함되어 있는지 재확인
        const lowerTitle = cleanTitle.toLowerCase();
        const lowerArtist = (identifier.artist || '').toLowerCase();
        const lowerAlbum = (identifier.title || '').toLowerCase();
        
        // 아티스트명이 없거나 제품명에 포함되지 않으면 차단
        if (!lowerArtist || lowerArtist.length < 2) {
          console.log(`[네이버] ❌ 아티스트명 없음: ${cleanTitle}`);
          continue;
        }
        
        // 아티스트명이 제품명에 포함되어 있는지 확인
        if (!lowerTitle.includes(lowerArtist)) {
          console.log(`[네이버] ❌ 아티스트명 불일치: ${cleanTitle} (기대: ${identifier.artist})`);
          continue;
        }
        
        // 앨범명도 확인 (95% 이상 매칭)
        if (lowerAlbum && lowerAlbum.length > 2) {
          const albumWords = lowerAlbum.split(/\s+/).filter(w => w.length > 2);
          if (albumWords.length > 0) {
            const matchCount = albumWords.filter(w => lowerTitle.includes(w)).length;
            const matchRatio = matchCount / albumWords.length;
            if (matchRatio < 0.95) {
              console.log(`[네이버] ❌ 앨범명 매칭 부족: ${cleanTitle} (기대: ${identifier.title}, 매칭률: ${(matchRatio * 100).toFixed(1)}%)`);
              continue;
            }
          }
        }
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
    const searchUrl = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(keyword)}&gbCode=MUC&target=total`;

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
      const priceText = item.find('.price > .val').first().text().replace(/[^0-9]/g, '');
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

        // Stock check based on text flags
        const fullText = item.text();
        const isSoldOut = fullText.includes('품절') || fullText.includes('일시품절');
        // If not explicitly sold out, assume in stock (Kyobo UI usually shows status clearly)
        const inStock = !isSoldOut;

        console.log(`[교보문고] ✅ Match Found: ${title} (${price.toLocaleString()}원) - Stock: ${inStock ? 'Yes' : 'No'}`);

        return {
          vendorName: '교보문고',
          channelId: 'mega-book',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '5만원 이상 무료배송',
          url: productLink,
          inStock: inStock,
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
  // 수집 전 검증 강화: EAN 또는 Discogs ID 필수
  if (!identifier.ean && !identifier.discogsId) {
    console.log(`[가격 수집] ❌ 스킵: EAN 또는 Discogs ID가 없습니다.`);
    return [];
  }

  // 수집 전 검증: 제목과 아티스트 모두 있어야 함
  if (!identifier.title || !identifier.artist) {
    console.log(`[가격 수집] ❌ 스킵: 제목 또는 아티스트 정보가 없습니다. (제목: ${identifier.title || '없음'}, 아티스트: ${identifier.artist || '없음'})`);
    return [];
  }

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

  // 최종 검증: Discogs에서 가져온 후에도 제목과 아티스트가 있어야 함
  if (!title || !artist) {
    console.log(`[가격 수집] ❌ 스킵: Discogs 정보 수집 후에도 제목 또는 아티스트가 없습니다.`);
    return [];
  }

  // 최종 식별자
  const finalIdentifier: ProductIdentifier = {
    ean: ean,
    discogsId: identifier.discogsId,
    title: title,
    artist: artist,
  };

  // 순차 호출로 변경 (Rate Limit 준수)
  // 우선순위: 알라딘, 네이버 먼저 시도
  console.log(`[가격 수집] 판매처 순차 검색 시작...`);

  // 우선순위 판매처 (알라딘, 네이버)
  const priorityVendors = [
    { name: '알라딘', fetch: () => fetchAladinPrice(finalIdentifier) },
    { name: '네이버', fetch: () => fetchNaverPrice(finalIdentifier) },
  ];

  // 일반 판매처
  const otherVendors = [
    { name: 'YES24', fetch: () => fetchYes24Price(finalIdentifier) },
    { name: '교보문고', fetch: () => fetchKyoboPrice(finalIdentifier) },
    { name: '인터파크', fetch: () => fetchInterparkPrice(finalIdentifier) },
    { name: '향뮤직', fetch: () => fetchHyangMusicPrice(finalIdentifier) },
    { name: '김밥레코드', fetch: () => fetchKimbapRecordPrice(finalIdentifier) },
    { name: '마장뮤직', fetch: () => fetchMajangMusicPrice(finalIdentifier) },
  ];

  // 우선순위 판매처 먼저 시도
  for (const vendor of priorityVendors) {
    try {
      const data = await vendor.fetch();
      if (data) {
        // URL 검증: 잘못된 링크 필터링
        if (!isValidUrl(data.url)) {
          console.log(`[가격 수집] 🚫 ${vendor.name} 잘못된 URL 스킵: ${data.url.substring(0, 60)}...`);
          continue;
        }
        offers.push(data);
        console.log(`[가격 수집] ✅ ${vendor.name}: ${data.basePrice.toLocaleString()}원`);
      }
      // Rate limit 보호: 각 호출 사이 딜레이 (테스트용: 2초로 축소)
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[가격 수집] ❌ ${vendor.name} 오류:`, error);
      // 에러가 발생해도 계속 진행
    }
  }

  // 일반 판매처 시도 (우선순위 판매처에서 결과를 찾지 못한 경우에만)
  // 하지만 모든 판매처를 확인하는 것이 좋으므로 계속 진행
  for (const vendor of otherVendors) {
    try {
      const data = await vendor.fetch();
      if (data) {
        // URL 검증: 잘못된 링크 필터링
        if (!isValidUrl(data.url)) {
          console.log(`[가격 수집] 🚫 ${vendor.name} 잘못된 URL 스킵: ${data.url.substring(0, 60)}...`);
          continue;
        }
        offers.push(data);
        console.log(`[가격 수집] ✅ ${vendor.name}: ${data.basePrice.toLocaleString()}원`);
      }
      // Rate limit 보호: 각 호출 사이 딜레이 (테스트용: 2초로 축소)
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[가격 수집] ❌ ${vendor.name} 오류:`, error);
      // 에러가 발생해도 계속 진행
    }
  }

  // Deduplicate offers based on URL to prevent redundancy
  // Enhanced Deduplication: Filter out offers with identical URLs (normalized)
  const normalizeUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // 프로토콜, 호스트, 경로만 비교 (쿼리 파라미터 제거)
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
    } catch {
      return url.trim().toLowerCase();
    }
  };

  const seenUrls = new Set<string>();
  const uniqueOffers: VendorOffer[] = [];

  for (const offer of offers) {
    if (!offer.url) continue;
    const normalizedUrl = normalizeUrl(offer.url);

    // Check if we already have this URL for this product
    if (seenUrls.has(normalizedUrl)) {
      console.log(`[가격 수집] 중복 URL 스킵: ${offer.url.substring(0, 60)}...`);
      continue;
    }

    seenUrls.add(normalizedUrl);
    uniqueOffers.push(offer);
  }

  const skippedCount = offers.length - uniqueOffers.length;
  if (skippedCount > 0) {
    console.log(`[가격 수집] 총 ${uniqueOffers.length}개의 고유 가격 정보를 찾았습니다. (${skippedCount}개 중복 제거됨)`);
  } else {
    console.log(`[가격 수집] 총 ${uniqueOffers.length}개의 고유 가격 정보를 찾았습니다.`);
  }
  return uniqueOffers;
}

/**
 * 제품의 가격 정보 업데이트
 * 중복 방지: URL 기반으로 중복 체크 후 삽입
 */
async function updateProductOffers(productId: string, offers: VendorOffer[]) {
  if (!supabase) return;

  // 기존 offers 가져오기 (중복 체크용)
  const { data: existingOffers } = await supabase
    .from('lp_offers')
    .select('id, url')
    .eq('product_id', productId);

  const existingUrls = new Set(
    (existingOffers || [])
      .map(o => o.url?.trim().toLowerCase())
      .filter(Boolean)
  );

  // URL 정규화 함수 (쿼리 파라미터 제거하여 비교)
  const normalizeUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // 프로토콜, 호스트, 경로만 비교 (쿼리 파라미터 제거)
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
    } catch {
      return url.trim().toLowerCase();
    }
  };

  // 중복 제거: 같은 URL이 이미 있으면 제외
  const uniqueOffers: VendorOffer[] = [];
  const seenNormalizedUrls = new Set<string>();

  for (const offer of offers) {
    if (!offer.url) continue;

    const normalizedUrl = normalizeUrl(offer.url);
    
    // 이미 본 URL이거나 기존 DB에 있는 URL이면 스킵
    if (seenNormalizedUrls.has(normalizedUrl) || existingUrls.has(normalizedUrl)) {
      console.log(`[중복 방지] 스킵: ${offer.url.substring(0, 60)}...`);
      continue;
    }

    seenNormalizedUrls.add(normalizedUrl);
    uniqueOffers.push(offer);
  }

  // 기존 offers 삭제 (전체 삭제 후 재삽입 방식)
  await supabase
    .from('lp_offers')
    .delete()
    .eq('product_id', productId);

  // URL 검증: 잘못된 링크 필터링
  const validOffers = uniqueOffers.filter(offer => {
    if (!isValidUrl(offer.url)) {
      console.log(`[중복 방지] 🚫 잘못된 URL 스킵: ${offer.url.substring(0, 60)}...`);
      return false;
    }
    return true;
  });

  // 고유하고 유효한 offers만 삽입
  if (validOffers.length > 0) {
    const offersToInsert = validOffers.map(offer => ({
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
      const skippedCount = offers.length - validOffers.length;
      if (skippedCount > 0) {
        console.log(`[DB Success] Inserted ${validOffers.length} offers for ${productId} (${skippedCount}개 중복/잘못된 링크 제거됨)`);
      } else {
        console.log(`[DB Success] Inserted ${validOffers.length} offers for ${productId}`);
      }
    }
  } else {
    console.log(`[DB Info] No offers to insert for ${productId} (모두 중복 또는 잘못된 링크)`);
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

    // 테스트용: 10개만 수집
    // 모든 제품 가져오기 (오래된 순서대로 10개만 - 테스트용)
    // 최근 24시간 내 동기화된 제품은 스킵
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: products, error } = await supabase
      .from('lp_products')
      .select('id, ean, discogs_id, title, artist, last_synced_at')
      .or(`last_synced_at.is.null,last_synced_at.lt.${oneDayAgo}`) // 최근 24시간 내 동기화된 제품 제외
      .order('last_synced_at', { ascending: true, nullsFirst: true }) // 가장 오래된(또는 한번도 안한) 것부터
      .limit(10); // 테스트용: 10개만 수집

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

        // API rate limit 고려하여 딜레이 추가
        // collectPricesForProduct 내부에서 이미 각 판매처별 딜레이가 있으므로
        // 제품 간 추가 딜레이는 최소화 (0.5초만 추가 - 테스트용)
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
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

