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

// USER_AGENT는 현재 사용하지 않음 (네이버 API는 헤더 불필요)


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
 * LP 매칭 검증 (엄격한 버전)
 */
function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier): boolean {
  if (!foundTitle || !identifier.title || !identifier.artist) return false;

  const lowerTitle = foundTitle.toLowerCase();

  // 1. LP 키워드 확인 (완화: LP 키워드가 없어도 아티스트+앨범명이 정확히 매칭되면 통과)
  const lpKeywords = ['lp', 'vinyl', '바이닐', '엘피', '레코드', 'record', '12"', '12인치', 'lp판', 'lp판본'];
  const hasLpKeyword = lpKeywords.some(k => lowerTitle.includes(k));
  
  // LP 키워드가 없으면 더 엄격한 검증 필요
  const needsStrictMatch = !hasLpKeyword;

  // 2. CD/디지털 키워드 명시적 차단
  const digitalKeywords = ['cd', 'compact disc', '디지털', 'digital', 'mp3', 'flac', 'cassette', '카세트'];
  const hasDigitalKeyword = digitalKeywords.some(k => lowerTitle.includes(k));
  
  if (hasDigitalKeyword) {
    return false; // CD/디지털 키워드가 있으면 무조건 차단
  }

  // 3. 정규화
  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedArtist = normalize(identifier.artist);
  const normalizedQueryTitle = normalize(identifier.title);

  // 4. 아티스트명 매칭 (필수)
  if (!normalizedArtist || normalizedArtist.length < 2) {
    return false;
  }
  
  // 아티스트명이 제목에 포함되어야 함
  if (!normalizedFoundTitle.includes(normalizedArtist)) {
    return false;
  }

  // 아티스트명 단어별 매칭 확인 (LP 키워드가 있으면 80%, 없으면 90% 이상)
  const artistWords = normalizedArtist.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 1);
  if (artistWords.length > 0) {
    const artistMatchCount = artistWords.filter(w => normalizedFoundTitle.includes(w)).length;
    const artistMatchRatio = artistMatchCount / artistWords.length;
    const requiredArtistRatio = needsStrictMatch ? 0.90 : 0.80;
    if (artistMatchRatio < requiredArtistRatio) {
      return false;
    }
  }

  // 5. 앨범명 매칭 (LP 키워드가 있으면 80%, 없으면 90% 이상)
  const titleWords = normalizedQueryTitle.split(/[^a-z0-9가-힣]+/).filter(w => w.length > 1);
  if (titleWords.length > 0) {
    const matchCount = titleWords.filter(w => normalizedFoundTitle.includes(w)).length;
    const matchRatio = matchCount / titleWords.length;
    const requiredTitleRatio = needsStrictMatch ? 0.90 : 0.80;
    if (matchRatio < requiredTitleRatio) {
      return false;
    }
  } else {
    // 단어가 없으면 전체 문자열 매칭 확인
    if (normalizedQueryTitle.length > 3 && !normalizedFoundTitle.includes(normalizedQueryTitle)) {
      return false;
    }
  }

  // 6. EAN이 있으면 EAN도 확인 (선택사항, 있으면 더 정확)
  if (identifier.ean && identifier.ean.length >= 8) {
    const eanDigits = identifier.ean.replace(/[^0-9]/g, '');
    if (eanDigits.length >= 8 && !normalizedFoundTitle.includes(eanDigits)) {
      // EAN이 제목에 없어도 통과 (EAN은 제목에 없을 수 있음)
      // 하지만 EAN이 제목에 있으면 더 확실함
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
    // 검색 쿼리 생성: EAN 우선, 없으면 정확한 아티스트+앨범명 검색
    let query = '';
    if (identifier.ean && identifier.ean.length >= 8) {
      // EAN이 있으면 EAN으로 정확 검색 (LP 키워드 추가)
      query = `${identifier.ean} LP`;
    } else if (identifier.artist && identifier.title) {
      // EAN이 없으면 아티스트명과 앨범명으로 검색 (따옴표 없이, LP 키워드 추가)
      const artist = identifier.artist.trim();
      const title = identifier.title.trim();
      query = `${artist} ${title} LP`;
    } else {
      console.log(`[네이버 가격 검색] ❌ 검색 불가: EAN 또는 (아티스트+앨범명) 필요`);
      return [];
    }
    
    console.log(`[네이버 가격 검색] 검색 쿼리: ${query}`);
    
    const response = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=50&sort=sim`,
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

    let filteredByPrice = 0;
    let filteredByDomain = 0;
    let filteredByUrl = 0;
    let filteredByMatch = 0;

    for (const item of data.items) {
      const cleanTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
      const price = parseInt(item.lprice, 10);

      if (price === 0 || !isValidPrice(price)) {
        filteredByPrice++;
        continue;
      }
      if (cleanTitle.length < 5) {
        continue;
      }
      
      // URL 도메인 확인
      let linkDomain = '';
      try {
        linkDomain = new URL(item.link).hostname;
      } catch (e) {
        continue;
      }

      const isAllowed = allowedDomains.some(d => linkDomain.includes(d));
      if (!isAllowed) {
        filteredByDomain++;
        continue;
      }

      // URL 중복 확인
      if (seenUrls.has(item.link)) {
        continue;
      }
      seenUrls.add(item.link);

      if (!isValidUrl(item.link)) {
        filteredByUrl++;
        console.log(`[네이버] ❌ URL 검증 실패: ${item.link.substring(0, 50)}...`);
        continue;
      }
      
      const isMatch = isValidLpMatch(cleanTitle, identifier);
      if (!isMatch) {
        filteredByMatch++;
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

      // 최대 10개까지만 수집 (더 많은 옵션 제공)
      if (offers.length >= 10) {
        break;
      }
    }

    console.log(`[네이버 가격 검색] 필터링 통계: 가격(${filteredByPrice}) 도메인(${filteredByDomain}) URL(${filteredByUrl}) 매칭(${filteredByMatch}) → 최종: ${offers.length}개`);

    console.log(`[네이버 가격 검색] 최종 결과: ${offers.length}개`);
    return offers;
  } catch (error) {
    console.error('[네이버 가격 검색 오류]', error);
    return [];
  }
}

/**
 * 네이버 쇼핑 API로 가격 검색 (단일 결과, 하위 호환성)
 * @deprecated fetchNaverPriceMultiple 사용
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
async function fetchNaverPrice(_identifier: ProductIdentifier): Promise<VendorOffer | null> {
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

  console.log(`[가격 수집] 시작: ${identifier.artist} - ${identifier.title} (EAN: ${identifier.ean || '없음'})`);

  const offers: VendorOffer[] = [];

  // 네이버 쇼핑 (가장 빠르고 안정적) - 여러 결과 수집
  try {
    const naverOffers = await fetchNaverPriceMultiple(identifier);
    offers.push(...naverOffers);
    console.log(`[가격 수집] 네이버에서 ${naverOffers.length}개 수집`);
  } catch (error) {
    console.error('[네이버 가격 검색 오류]', error);
  }

  // TODO: 다른 판매처 추가 (Yes24, 알라딘, 교보문고 등)
  // 현재는 네이버만 구현 (안정성 우선)

  console.log(`[가격 수집] 완료: 총 ${offers.length}개 수집`);
  return offers;
}
