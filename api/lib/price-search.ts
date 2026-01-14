/**
 * 가격 검색 로직 (Vercel Serverless Function용)
 * scripts/sync-lp-data.ts의 핵심 로직만 추출
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

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * HTTP 요청 헬퍼
 */
async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Failed to fetch');
}

/**
 * 숫자만 추출
 */
function extractNumber(text: string): number {
  const cleaned = text.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * 문자열 정규화 헬퍼
 */
function normalize(str: string): string {
  return str.replace(/[\s_.,()[\]-]/g, '').toLowerCase();
}

/**
 * URL 검증
 */
function isValidUrl(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const lowerPath = urlObj.pathname.toLowerCase();

    const invalidCategories = [
      '/book/', '/책/', '/novel/', '/소설/',
      '/clothing/', '/의류/', '/apparel/', '/fashion/',
      '/health/', '/건강/', '/scale/', '/체중계/',
      '/poster/', '/포스터/', '/goods/', '/굿즈/',
      '/cd/', '/compact-disc/', '/cassette/', '/카세트/',
      '/turntable/', '/턴테이블/', '/needle/', '/stylus/',
    ];

    const hasInvalidCategory = invalidCategories.some(cat => lowerPath.includes(cat));
    if (hasInvalidCategory) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * LP 매칭 검증 (완화된 버전)
 */
function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier): boolean {
  if (!foundTitle || !identifier.title || !identifier.artist) return false;

  const lowerTitle = foundTitle.toLowerCase();
  const lowerQueryTitle = identifier.title.toLowerCase();
  const lowerArtist = identifier.artist.toLowerCase();

  // CD/디지털 명시적 차단 (LP 키워드가 있으면 통과)
  const digitalKeywords = ['cd', 'compact disc', '디지털', 'digital', 'mp3', 'flac'];
  const hasDigitalKeyword = digitalKeywords.some(k => lowerTitle.includes(k));
  const hasLpKeyword = ['lp', 'vinyl', '바이닐', '엘피', '레코드', 'record', '12"', '12인치'].some(k => lowerTitle.includes(k));
  
  // CD/디지털 키워드가 있고 LP 키워드가 없으면 차단
  if (hasDigitalKeyword && !hasLpKeyword) {
    return false;
  }

  // 정규화
  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedArtist = normalize(identifier.artist);
  const normalizedQueryTitle = normalize(identifier.title);

  // 아티스트명 매칭 (필수)
  if (!normalizedArtist || normalizedArtist.length < 2) {
    return false;
  }
  
  // 아티스트명이 제목에 포함되어야 함 (부분 매칭 허용)
  if (!normalizedFoundTitle.includes(normalizedArtist)) {
    return false;
  }

  // 앨범명 매칭 (완화: 70% 이상으로 낮춤)
  const titleWords = normalizedQueryTitle.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 1);
  if (titleWords.length > 0) {
    const matchCount = titleWords.filter(w => normalizedFoundTitle.includes(w)).length;
    const matchRatio = matchCount / titleWords.length;
    // 70% 이상 매칭이면 통과 (매우 완화)
    if (matchRatio < 0.70) {
      return false;
    }
  } else {
    // 단어가 없으면 전체 문자열 매칭 확인
    if (normalizedQueryTitle.length > 3 && !normalizedFoundTitle.includes(normalizedQueryTitle)) {
      return false;
    }
  }

  return true;
}

/**
 * 가격 유효성 검사
 */
function isValidPrice(price: number): boolean {
  return price >= 20000 && price <= 1000000;
}

/**
 * 네이버 쇼핑 API로 가격 검색 (여러 결과)
 */
async function fetchNaverPriceMultiple(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    const naverEnvKeys = Object.keys(process.env).filter(k => k.includes('NAVER'));
    console.error('[네이버 가격 검색] ❌ 환경 변수 없음:', {
      hasClientId: !!NAVER_CLIENT_ID,
      hasClientSecret: !!NAVER_CLIENT_SECRET,
      foundNaverKeys: naverEnvKeys
    });
    return [];
  }

  try {
    const query = identifier.ean || `${identifier.artist} ${identifier.title} LP`;
    console.log(`[네이버 가격 검색] 검색 쿼리: ${query}`);
    
    const response = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=20&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[네이버 가격 검색] ❌ API 오류: ${response.status} ${response.statusText}`, errorText);
      return [];
    }

    const data = await response.json();
    console.log(`[네이버 가격 검색] 검색 결과: ${data.items?.length || 0}개`);
    
    if (!data.items || data.items.length === 0) {
      console.log('[네이버 가격 검색] 검색 결과 없음');
      return [];
    }

    const offers: VendorOffer[] = [];
    const seenUrls = new Set<string>();

    // 도메인 화이트리스트 (신뢰할 수 있는 판매처만)
    const allowedDomains = [
      'smartstore.naver.com',
      'brand.naver.com',
      'shopping.naver.com',
      'www.yes24.com',
      'www.aladin.co.kr',
      'www.synnara.co.kr',
      'hottracks.kyobobook.co.kr',
      'book.interpark.com',
      'shopping.interpark.com',
      'www.coupang.com',
      'www.gmarket.co.kr',
      'www.auction.co.kr',
    ];

    for (const item of data.items) {
      const cleanTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
      const price = parseInt(item.lprice, 10);

      if (price === 0 || !isValidPrice(price)) continue;
      if (cleanTitle.length < 5) continue;
      
      // URL 도메인 확인
      let linkDomain = '';
      try {
        linkDomain = new URL(item.link).hostname;
      } catch (e) {
        continue;
      }

      const isAllowed = allowedDomains.some(d => linkDomain.includes(d));
      if (!isAllowed) {
        continue;
      }

      // URL 중복 확인
      if (seenUrls.has(item.link)) {
        continue;
      }
      seenUrls.add(item.link);

      if (!isValidUrl(item.link)) {
        console.log(`[네이버] ❌ URL 검증 실패: ${item.link.substring(0, 50)}...`);
        continue;
      }
      
      const isMatch = isValidLpMatch(cleanTitle, identifier);
      if (!isMatch) {
        console.log(`[네이버] ❌ LP 매칭 실패: "${cleanTitle.substring(0, 50)}..." (기대: ${identifier.artist} - ${identifier.title})`);
        continue;
      }

      console.log(`[네이버] ✅ 매칭 성공: "${cleanTitle.substring(0, 50)}..." (가격: ${price}원)`);
      
      offers.push({
        vendorName: '네이버 쇼핑',
        channelId: 'naver',
        basePrice: price,
        shippingFee: 0,
        shippingPolicy: '별도',
        url: item.link,
        inStock: true,
      });

      // 최대 5개까지만 수집 (너무 많으면 의미 없음)
      if (offers.length >= 5) {
        break;
      }
    }

    console.log(`[네이버 가격 검색] 최종 결과: ${offers.length}개`);
    return offers;
  } catch (error) {
    console.error('[네이버 가격 검색 오류]', error);
    return [];
  }
}

/**
 * 네이버 쇼핑 API로 가격 검색 (단일 결과, 하위 호환성)
 */
async function fetchNaverPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

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

    // 도메인 화이트리스트 (신뢰할 수 있는 판매처만)
    const allowedDomains = [
      'smartstore.naver.com',
      'brand.naver.com',
      'shopping.naver.com',
      'www.yes24.com',
      'www.aladin.co.kr',
      'www.synnara.co.kr',
      'hottracks.kyobobook.co.kr',
      'book.interpark.com',
      'shopping.interpark.com',
      'www.coupang.com',
      'www.gmarket.co.kr',
      'www.auction.co.kr',
    ];

    for (const item of data.items) {
      const cleanTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
      const price = parseInt(item.lprice, 10);

      if (price === 0 || !isValidPrice(price)) continue;
      if (cleanTitle.length < 5) continue;
      
      // URL 도메인 확인
      let linkDomain = '';
      try {
        linkDomain = new URL(item.link).hostname;
      } catch (e) {
        continue;
      }

      const isAllowed = allowedDomains.some(d => linkDomain.includes(d));
      if (!isAllowed) {
        continue; // 신뢰할 수 없는 판매처 제외
      }

      if (!isValidUrl(item.link)) continue;
      if (!isValidLpMatch(cleanTitle, identifier)) continue;

      // 첫 번째 매칭되는 항목 반환 (가장 관련성 높은 것)
      return {
        vendorName: '네이버 쇼핑',
        channelId: 'naver',
        basePrice: price,
        shippingFee: 0,
        shippingPolicy: '별도',
        url: item.link,
        inStock: true,
      };
    }

    return null;
  } catch (error) {
    console.error('[네이버 가격 검색 오류]', error);
    return null;
  }
}

/**
 * 모든 판매처에서 가격 수집
 */
export async function collectPricesForProduct(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  // 검증
  if (!identifier.title || !identifier.artist) {
    console.log('[가격 수집] ❌ 제목 또는 아티스트 정보가 없습니다.');
    return [];
  }

  const offers: VendorOffer[] = [];

  // 네이버 쇼핑 (가장 빠르고 안정적) - 여러 결과 수집
  try {
    const naverOffers = await fetchNaverPriceMultiple(identifier);
    offers.push(...naverOffers);
  } catch (error) {
    console.error('[네이버 가격 검색 오류]', error);
  }

  // 각 API 호출 사이에 딜레이 (Rate Limit 방지)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 여러 개의 결과를 반환하도록 수정 (첫 번째만 반환하지 않고)
  // 네이버 쇼핑에서 여러 결과 수집
  try {
    const naverOffers = await fetchNaverPriceMultiple(identifier);
    offers.push(...naverOffers);
  } catch (error) {
    console.error('[네이버 가격 검색 오류]', error);
  }

  // TODO: 다른 판매처 추가 (Yes24, 알라딘, 교보문고 등)
  // 현재는 네이버만 구현 (안정성 우선)

  return offers;
}
