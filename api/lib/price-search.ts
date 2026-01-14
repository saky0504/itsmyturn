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
 * LP 매칭 검증
 */
function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier): boolean {
  if (!foundTitle || !identifier.title || !identifier.artist) return false;

  const lowerTitle = foundTitle.toLowerCase();
  const lowerQueryTitle = identifier.title.toLowerCase();
  const lowerArtist = identifier.artist.toLowerCase();

  // CD/디지털 차단
  const digitalKeywords = ['cd', 'compact disc', '디지털', 'digital', 'mp3'];
  if (digitalKeywords.some(k => lowerTitle.includes(k) && !lowerTitle.includes('lp') && !lowerTitle.includes('vinyl'))) {
    return false;
  }

  // LP 키워드 필수
  const lpKeywords = ['lp', 'vinyl', '바이닐', '엘피', '레코드', 'record', '12"'];
  if (!lpKeywords.some(k => lowerTitle.includes(k))) {
    return false;
  }

  // 아티스트명 매칭
  const normalize = (str: string) => str.replace(/[\s_.,()[\]-]/g, '').toLowerCase();
  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedArtist = normalize(identifier.artist);
  const normalizedQueryTitle = normalize(identifier.title);

  if (!normalizedFoundTitle.includes(normalizedArtist)) {
    return false;
  }

  // 앨범명 95% 이상 매칭
  const titleWords = normalizedQueryTitle.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 2);
  if (titleWords.length > 0) {
    const matchCount = titleWords.filter(w => normalizedFoundTitle.includes(w)).length;
    const matchRatio = matchCount / titleWords.length;
    if (matchRatio < 0.95) {
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
 * 네이버 쇼핑 API로 가격 검색
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

    for (const item of data.items) {
      const cleanTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
      const price = parseInt(item.lprice, 10);

      if (price === 0 || !isValidPrice(price)) continue;
      if (cleanTitle.length < 5) continue;
      if (!isValidLpMatch(cleanTitle, identifier)) continue;
      if (!isValidUrl(item.link)) continue;

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

  // 네이버 쇼핑 (가장 빠르고 안정적)
  try {
    const naverOffer = await fetchNaverPrice(identifier);
    if (naverOffer) {
      offers.push(naverOffer);
    }
  } catch (error) {
    console.error('[네이버 가격 검색 오류]', error);
  }

  // 각 API 호출 사이에 딜레이 (Rate Limit 방지)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // TODO: 다른 판매처 추가 (Yes24, 알라딘, 교보문고 등)
  // 현재는 네이버만 구현 (안정성 우선)

  return offers;
}
