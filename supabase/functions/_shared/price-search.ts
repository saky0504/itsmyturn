/**
 * 가격 검색 로직 모듈 (Deno 환경용)
 * 기존 scripts/sync-lp-data.ts의 로직을 Deno 환경에서 사용 가능하도록 변환
 */

export interface ProductIdentifier {
  ean?: string;
  discogsId?: string;
  title?: string;
  artist?: string;
}

export interface VendorOffer {
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

// 환경 변수에서 API 키 가져오기
const NAVER_CLIENT_ID = Deno.env.get('NAVER_CLIENT_ID');
const NAVER_CLIENT_SECRET = Deno.env.get('NAVER_CLIENT_SECRET');
const ALADIN_TTB_KEY = Deno.env.get('ALADIN_TTB_KEY');

/**
 * 가격 유효성 검사
 */
function isValidPrice(price: number): boolean {
  return price >= 20000 && price <= 1000000;
}

/**
 * URL 검증 함수
 */
function isValidUrl(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const lowerPath = urlObj.pathname.toLowerCase();
    const lowerHost = urlObj.hostname.toLowerCase();

    // 네이버 스마트스토어 URL 특별 처리
    if (lowerHost.includes('smartstore.naver.com')) {
      if (lowerPath.includes('/health/') || lowerPath.includes('/book/') || lowerPath.includes('/clothing/')) {
        return false;
      }
      return true;
    }

    // 음악 카테고리 확인
    const musicCategories = ['/music/', '/lp/', '/vinyl/', '/record/', '/album/', '/음악/', '/레코드/', '/앨범/'];
    const isMusicCategory = musicCategories.some(cat => lowerPath.includes(cat));

    // 잘못된 카테고리 차단
    const invalidCategories = [
      '/book/', '/책/', '/novel/', '/소설/',
      '/clothing/', '/의류/', '/apparel/', '/fashion/',
      '/electronics/', '/전자/', '/health/', '/건강/',
      '/scale/', '/체중계/', '/inbody/', '/인바디/',
      '/poster/', '/포스터/', '/goods/', '/굿즈/',
      '/cd/', '/compact-disc/', '/cassette/', '/카세트/',
      '/turntable/', '/턴테이블/', '/needle/', '/stylus/',
    ];

    const hasInvalidCategory = invalidCategories.some(cat => lowerPath.includes(cat));
    if (hasInvalidCategory && !isMusicCategory) {
      return false;
    }

    return true;
  } catch {
    return true; // 파싱 실패 시 통과
  }
}

/**
 * LP 매칭 검증 함수 (95% 이상 매칭 필수)
 */
function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier): boolean {
  if (!foundTitle) return false;

  const lowerTitle = foundTitle.toLowerCase();

  // CD/디지털 차단
  const digitalKeywords = [
    'cd', 'compact disc', '디지털', 'digital', 'mp3', 'flac', 'wav',
    '오디오 cd', 'audio cd', 'cd single', 'cd 싱글', 'cd 앨범'
  ];
  if (digitalKeywords.some(k => lowerTitle.includes(k) && !lowerTitle.includes('lp') && !lowerTitle.includes('vinyl'))) {
    return false;
  }

  // 포스터/굿즈 차단
  const nonMusicKeywords = [
    '원피스', 'dress', '티셔츠', 't-shirt', 'shirt', '후드', 'hoodie',
    '책', 'book', '만화', 'comic', '소설', 'novel',
    '체중계', 'scale', '체중', '저울', '인바디', 'inbody',
    '굿즈', 'goods', 'merch', 'poster', '포스터',
    'cassette', 'tape', '카세트', 'turntable', '턴테이블',
  ];
  if (nonMusicKeywords.some(k => lowerTitle.includes(k))) {
    return false;
  }

  // LP 키워드 필수
  const lpKeywords = ['lp', 'vinyl', '바이닐', '엘피', '레코드', 'record', '12"', '12인치'];
  if (!lpKeywords.some(k => lowerTitle.includes(k))) {
    return false;
  }

  // 아티스트/앨범명 매칭 (95% 이상)
  const normalize = (str: string) => str.replace(/[\s_.,()[\]-]/g, '').toLowerCase();
  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedQueryTitle = normalize(identifier.title || '');
  const normalizedArtist = normalize(identifier.artist || '');

  // 아티스트명 필수
  if (!normalizedArtist || normalizedArtist.length === 0) {
    return false;
  }
  const artistMatch = normalizedFoundTitle.includes(normalizedArtist);

  // 앨범명 95% 이상 매칭
  let titleMatch = false;
  if (normalizedQueryTitle && normalizedQueryTitle.length > 0) {
    const titleWords = normalizedQueryTitle.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 2);
    if (titleWords.length > 0) {
      const matchCount = titleWords.filter(w => normalizedFoundTitle.includes(w)).length;
      const matchRatio = matchCount / titleWords.length;
      titleMatch = matchRatio >= 0.95;
    } else {
      titleMatch = normalizedFoundTitle.includes(normalizedQueryTitle);
    }
  } else {
    return false;
  }

  return artistMatch && titleMatch;
}

/**
 * 네이버 쇼핑 API로 가격 검색
 */
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

    for (const item of data.items) {
      const rawTitle = item.title || '';
      const cleanTitle = rawTitle.replace(/<[^>]+>/g, '').trim();
      const price = parseInt(item.lprice, 10);

      if (price === 0) continue;
      if (!isValidPrice(price)) continue;
      if (cleanTitle.length < 5) continue;
      if (/^[\d\s\-]+$/.test(cleanTitle)) continue;
      if (!isValidLpMatch(cleanTitle, identifier)) continue;

      // 도메인 화이트리스트
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

      let linkDomain = '';
      try {
        linkDomain = new URL(item.link).hostname;
      } catch {
        continue;
      }

      if (!allowedDomains.some(d => linkDomain.includes(d))) {
        continue;
      }

      // 네이버 스마트스토어 추가 검증
      if (linkDomain.includes('smartstore.naver.com')) {
        const lowerTitle = cleanTitle.toLowerCase();
        const lowerArtist = (identifier.artist || '').toLowerCase();
        const lowerAlbum = (identifier.title || '').toLowerCase();
        
        if (!lowerArtist || lowerArtist.length < 2 || !lowerTitle.includes(lowerArtist)) {
          continue;
        }
        
        if (lowerAlbum && lowerAlbum.length > 2) {
          const albumWords = lowerAlbum.split(/\s+/).filter(w => w.length > 2);
          if (albumWords.length > 0) {
            const matchCount = albumWords.filter(w => lowerTitle.includes(w)).length;
            const matchRatio = matchCount / albumWords.length;
            if (matchRatio < 0.95) {
              continue;
            }
          }
        }
      }

      if (!isValidUrl(item.link)) {
        continue;
      }

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

    return null;
  } catch (error) {
    console.error('[네이버] API Error:', error);
    return null;
  }
}

/**
 * 알라딘 Open API로 가격 검색
 */
async function fetchAladinPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  if (!ALADIN_TTB_KEY) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      ttbkey: ALADIN_TTB_KEY,
      QueryType: 'Keyword',
      Query: identifier.ean || `${identifier.artist} ${identifier.title} LP`,
      MaxResults: '10',
      start: '1',
      SearchTarget: 'Music',
      Output: 'JS',
      Version: '20131101'
    });

    const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.item || !Array.isArray(data.item) || data.item.length === 0) {
      return null;
    }

    for (const item of data.item) {
      const title = item.title;
      const price = item.priceSales || item.priceStandard;

      if (!title || price === 0) continue;
      if (!isValidLpMatch(title, identifier)) continue;
      if (price < 15000 || price > 500000) continue;

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
    }

    return null;
  } catch (error) {
    console.error('[알라딘] API Error:', error);
    return null;
  }
}

/**
 * 모든 판매처에서 가격 정보 수집 (우선순위 판매처만)
 */
export async function collectPricesForProduct(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  // 수집 전 검증
  if (!identifier.ean && !identifier.discogsId) {
    return [];
  }
  if (!identifier.title || !identifier.artist) {
    return [];
  }

  const offers: VendorOffer[] = [];

  // 우선순위 판매처만 검색 (빠른 응답을 위해)
  const priorityVendors = [
    { name: '알라딘', fetch: () => fetchAladinPrice(identifier) },
    { name: '네이버', fetch: () => fetchNaverPrice(identifier) },
  ];

  // 순차 호출 (Rate Limit 준수)
  for (const vendor of priorityVendors) {
    try {
      const data = await vendor.fetch();
      if (data && isValidUrl(data.url)) {
        offers.push(data);
      }
      // 딜레이 (2초)
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[가격 수집] ❌ ${vendor.name} 오류:`, error);
    }
  }

  // URL 중복 제거
  const normalizeUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
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
    if (!seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl);
      uniqueOffers.push(offer);
    }
  }

  return uniqueOffers;
}
