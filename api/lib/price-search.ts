import * as cheerio from 'cheerio';

export interface ProductIdentifier {
  ean?: string;
  discogsId?: string;
  title?: string;
  artist?: string;
  vendor?: string;
}

export interface VendorOffer {
  vendorName: string;
  channelId: string;
  basePrice: number;
  shippingFee: number;
  shippingPolicy: string;
  url: string;
  inStock: boolean;
  badge?: 'fresh' | 'lowest' | 'exclusive' | 'used' | 'out-of-print';
  affiliateCode?: string;
  affiliateParamKey?: string;
  notes?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchWithRetry(url: string, retries = 1): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return '';
}

function extractNumber(text: string): number {
  return parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
}

function tokenize(str: string): string[] {
  return str.toLowerCase().replace(/[^a-z0-9가-힣]/g, ' ').split(/\s+/).filter(w => w.length > 1);
}

function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier): boolean {
  if (!foundTitle) return false;

  const lowerTitle = foundTitle.toLowerCase();

  // 1. Strict Blacklist
  const blackListExact = ['cd', 'dvd', 'mp3', 'wav', 'flac'];
  const blackListIncludes = [
    '디지털', '오디오', 'cassette', '카세트', 'tape', '테이프', 'blu-ray', '블루레이',
    '포스터', 'poster', '티셔츠', '의류', '굿즈', '잡지', 'magazine', '액자',
    '키링', 'keyring', '체중계', 'scale', '저울', '달력', 'calendar',
    '보호', '슬리브', '클리너', '브러쉬'
  ];

  // 영어 단어(cd, dvd 등)는 독립된 단어일 때만 필터링 (e.g. MacDemarco에서 cd가 걸리는 것 방지)
  for (const word of blackListExact) {
    const rx = new RegExp(`\\b${word}\\b`);
    if (rx.test(lowerTitle)) return false;
  }

  // 한글/그 외 단어는 부분 일치로 필터링
  if (blackListIncludes.some(k => lowerTitle.includes(k))) return false;

  // 2. Token Matching with Consumption
  const titleTokens = tokenize(lowerTitle);
  const artistTokens = identifier.artist ? tokenize(identifier.artist) : [];
  const albumTokens = identifier.title ? tokenize(identifier.title) : [];

  if (artistTokens.length === 0 && albumTokens.length === 0) return true;

  let artistMatchCount = 0;
  for (const token of artistTokens) {
    const idx = titleTokens.findIndex(t => t.includes(token));
    if (idx !== -1) {
      artistMatchCount++;
      // Consume the matched token from the scraped title pool so it can't be reused
      titleTokens.splice(idx, 1);
    }
  }

  let albumMatchCount = 0;
  for (const token of albumTokens) {
    const idx = titleTokens.findIndex(t => t.includes(token));
    if (idx !== -1) {
      albumMatchCount++;
      // Consume
      titleTokens.splice(idx, 1);
    }
  }

  // 앨범명 토큰이 존재한다면, 반드시 앨범명 중에서 일부는 매치되어야 함. (비율 40%)
  if (albumTokens.length > 0) {
    const requiredAlbumMatches = Math.max(1, Math.floor(albumTokens.length * 0.4));
    if (albumMatchCount < requiredAlbumMatches) {
      return false;
    }
  }

  const totalTokens = artistTokens.length + albumTokens.length;
  const matchCount = artistMatchCount + albumMatchCount;
  // 전체 토큰 중에서도 40%는 매칭되어야 함
  const requiredMatches = Math.max(1, Math.floor(totalTokens * 0.4));

  if (matchCount < requiredMatches) {
    return false;
  }

  // 최후의 보루: 타이틀에 반드시 lp, vinyl, 바이닐 중 하나가 포함되어야 함 (단어의 일부여도 됨)
  // CD가 섞여 들어오는 것을 막기 위한 강력한 필터
  const hasLpKeyword = ['lp', 'vinyl', '바이닐'].some(k => lowerTitle.includes(k));
  if (!hasLpKeyword) {
    return false;
  }

  return true;
}

function parseStatusFlags(title: string): { badge?: 'used' | 'out-of-print' } {
  const lowerTitle = title.toLowerCase();

  // 1. 중고 (Used) - 중고가 절판보다 상태정보로서 우선순위가 높음
  if (lowerTitle.includes('중고') || lowerTitle.includes('used')) {
    return { badge: 'used' };
  }

  // 2. 절판 (Out of Print)
  if (lowerTitle.includes('절판') || lowerTitle.includes('out of print')) {
    return { badge: 'out-of-print' };
  }

  return {};
}

function isValidPrice(price: number): boolean {
  return price >= 15000 && price <= 500000;
}

async function fetchNaverPrice(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];

  const searchNaver = async (query: string) => {
    try {
      const res = await fetch(`https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=20`, {
        headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }
      });
      if (!res.ok) return [];
      const data = await res.json();

      const offers: VendorOffer[] = [];
      const allowedDomains = ['smartstore.naver.com', 'brand.naver.com', 'shopping.naver.com', 'yes24.com', 'aladin.co.kr', 'kyobobook.co.kr'];

      for (const item of data.items || []) {
        const cleanTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
        const price = parseInt(item.lprice, 10);
        if (!isValidPrice(price)) continue;

        let domain = '';
        try { domain = new URL(item.link).hostname; } catch (e) { }
        if (!allowedDomains.some(d => domain.includes(d))) continue;

        // 네이버 카탈로그 페이지 (가격비교) 제외
        if (item.link.includes('search.shopping.naver.com/catalog')) continue;

        if (!isValidLpMatch(cleanTitle, identifier)) continue;

        const status = parseStatusFlags(cleanTitle);
        // Naver API does not specify OOS natively. Strict check only for explicitly bracketed labels to avoid "품절임박"
        const isExplicitlySoldOut = cleanTitle.includes('[품절]') || cleanTitle.includes('(품절)') || cleanTitle.includes('품절된');

        offers.push({
          vendorName: item.mallName || '네이버 쇼핑', // 실제 쇼핑몰 이름을 바로 사용
          channelId: 'naver',
          basePrice: price,
          shippingFee: parseInt(item.deliveryFee || "0", 10),
          shippingPolicy: '상세조건 확인',
          url: item.link,
          inStock: !isExplicitlySoldOut,
          badge: status.badge,
        });
      }
      return offers;
    } catch (e) {
      return [];
    }
  };

  const cleanEan = identifier.ean ? identifier.ean.replace(/[^0-9]/g, '') : '';
  let offers: VendorOffer[] = [];
  if (cleanEan) {
    offers = await searchNaver(cleanEan);
  }

  if (offers.length === 0) {
    const keywordQuery = `${identifier.artist} ${identifier.title} LP`;
    offers = await searchNaver(keywordQuery);
  }

  return offers;
}

async function fetchAladinPrice(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const aladinTtbKey = process.env.ALADIN_TTB_KEY;
  if (!aladinTtbKey) return [];

  const searchAladin = async (query: string) => {
    try {
      const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinTtbKey}&QueryType=Keyword&Query=${encodeURIComponent(query)}&MaxResults=5&start=1&SearchTarget=Music&Output=JS&Version=20131101`;
      const res = await fetch(url);
      const data = await res.json();

      const offers: VendorOffer[] = [];
      for (const item of data.item || []) {
        const title = item.title;
        const price = item.priceSales || item.priceStandard;
        if (!isValidPrice(price)) continue;
        if (!isValidLpMatch(title, identifier)) continue;

        const status = parseStatusFlags(title);
        // Aladin stockStatus: '' means Normal, '품절'/'절판' means out of stock
        const isAladinOos = item.stockStatus === '품절' || item.stockStatus === '절판';
        if (item.stockStatus === '절판') status.badge = 'out-of-print';

        offers.push({
          vendorName: '알라딘',
          channelId: 'aladin',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '조건부 무료',
          url: item.link,
          inStock: !isAladinOos,
          badge: status.badge,
        });
      }
      return offers;
    } catch (e) { return []; }
  };

  const cleanEan = identifier.ean ? identifier.ean.replace(/[^0-9]/g, '') : '';
  let offers: VendorOffer[] = [];
  if (cleanEan) {
    offers = await searchAladin(cleanEan);
  }

  if (offers.length === 0) {
    const keywordQuery = `${identifier.artist} ${identifier.title} LP`;
    offers = await searchAladin(keywordQuery);
  }

  return offers;
}

async function fetchYes24Price(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const searchYes24 = async (query: string) => {
    try {
      const url = `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(query)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

      const response = await fetch(url, {
        redirect: 'manual', // DO NOT follow the 302 redirect for EANs!
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok || response.status === 302) return []; // 302 means NO RESULTS

      const html = await response.text();
      if (!html) return [];

      const $ = cheerio.load(html);
      const offers: VendorOffer[] = [];

      $('.itemUnit').slice(0, 5).each((_, el) => {
        const item = $(el);
        const title = item.find('a.gd_name').text().trim() || item.find('.gd_name').text().trim() || item.find('.goods_name a').first().text().trim();
        const link = item.find('a').first().attr('href');
        const priceText = item.find('.yes_price, .price, .yes_b').first().text();
        const price = extractNumber(priceText);

        if (!title || !link || !isValidPrice(price)) return;
        if (!isValidLpMatch(title, identifier)) return;

        const status = parseStatusFlags(title);
        const tagsRaw = item.find('.icon_line, .icon_tag, .yes_tag, .yes_b').text();
        const isYes24Oos = tagsRaw.includes('품절') || tagsRaw.includes('절판');
        if (tagsRaw.includes('절판')) status.badge = 'out-of-print';

        const inStock = price > 0 && !isYes24Oos;

        offers.push({
          vendorName: 'YES24',
          channelId: 'yes24',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '5만원 무료',
          url: link.startsWith('http') ? link : `https://www.yes24.com${link}`,
          inStock,
          badge: status.badge,
        });
      });
      return offers;
    } catch (e) { return []; }
  };

  const cleanEan = identifier.ean ? identifier.ean.replace(/[^0-9]/g, '') : '';
  let offers: VendorOffer[] = [];
  if (cleanEan) {
    offers = await searchYes24(cleanEan);
  }

  if (offers.length === 0) {
    const keywordQuery = `${identifier.artist} ${identifier.title} LP`;
    offers = await searchYes24(keywordQuery);
  }

  return offers;
}

async function fetchKyoboPrice(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const searchKyobo = async (query: string) => {
    try {
      const url = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(query)}&gbCode=TOT&target=total`;
      const html = await fetchWithRetry(url);
      if (!html) return [];

      const $ = cheerio.load(html);
      const offers: VendorOffer[] = [];

      $('.prod_item').slice(0, 5).each((_, el) => {
        const item = $(el);
        const titleSpan = item.find('a.prod_info span[id^="cmdtName"]');
        const title = titleSpan.length ? titleSpan.text().trim() : item.find('.prod_info').text().replace(/\s+/g, ' ').trim();
        const link = item.find('a.prod_info').attr('href');
        const priceText = item.find('.price .val').text();
        const price = extractNumber(priceText);

        if (!title || !link || !isValidPrice(price)) return;
        if (!isValidLpMatch(title, identifier)) return;

        // In Kyobo, if there is a price it usually means it can be bought
        const status = parseStatusFlags(title);
        const kyoboStateDiv = item.find('.prod_state, .badge_inner span, .badge_sm span').text();
        const isKyoboOos = kyoboStateDiv.includes('품절') || kyoboStateDiv.includes('절판');
        if (kyoboStateDiv.includes('절판')) status.badge = 'out-of-print';

        const inStock = price > 0 && !isKyoboOos;

        offers.push({
          vendorName: '교보문고',
          channelId: 'kyobo',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '조건부 무료',
          url: link.startsWith('http') ? link : `https://product.kyobobook.co.kr${link}`,
          inStock,
          badge: status.badge,
        });
      });
      return offers;
    } catch (e) { return []; }
  };

  const cleanEan = identifier.ean ? identifier.ean.replace(/[^0-9]/g, '') : '';
  let offers: VendorOffer[] = [];
  if (cleanEan) {
    offers = await searchKyobo(cleanEan);
  }

  if (offers.length === 0) {
    const keywordQuery = `${identifier.artist} ${identifier.title} LP`;
    offers = await searchKyobo(keywordQuery);
  }

  return offers;
}

export async function collectPricesForProduct(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const { vendor } = identifier;
  const offers: VendorOffer[] = [];

  if (vendor === 'naver') {
    return await fetchNaverPrice(identifier);
  } else if (vendor === 'aladin') {
    return await fetchAladinPrice(identifier);
  } else if (vendor === 'yes24') {
    return await fetchYes24Price(identifier);
  } else if (vendor === 'kyobo') {
    return await fetchKyoboPrice(identifier);
  } else {
    const results = await Promise.allSettled([
      fetchNaverPrice(identifier),
      fetchAladinPrice(identifier),
      fetchYes24Price(identifier),
      fetchKyoboPrice(identifier)
    ]);
    for (const res of results) {
      if (res.status === 'fulfilled') offers.push(...res.value);
    }
  }

  return offers;
}
