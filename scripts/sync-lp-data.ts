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
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env 파일 로드 시도 (환경변수 설정 전에 실행)
try {
  const envPath = resolve(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  });
} catch (error) {
  // .env 파일이 없어도 계속 진행
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // 환경변수가 없으면 나중에 설정될 수 있도록 지연 초기화
  console.warn('⚠️  Supabase 환경변수가 설정되지 않았습니다. 크롤링만 테스트하는 경우 무시할 수 있습니다.');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null as any; // 테스트용으로 null 허용

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
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      // 재시도 전 대기 (지수 백오프)
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

/**
 * 간단한 문자열 유사도 계산 (Dice Coefficient)
 * 0.0 ~ 1.0 (1.0이 완전 일치)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }

  const bigrams2 = new Set<string>();
  for (let i = 0; i < s2.length - 1; i++) {
    bigrams2.add(s2.substring(i, i + 2));
  }

  let intersection = 0;
  bigrams1.forEach(bg => {
    if (bigrams2.has(bg)) intersection++;
  });

  return (2 * intersection) / (bigrams1.size + bigrams2.size);
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
      const searchQuery = `${identifier.artist} ${identifier.title}`;
      searchUrl = `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    // YES24 검색 결과에서 첫 번째 제품 찾기
    // 다양한 선택자 시도
    let firstItem = $('.goodsList_item').first();
    if (firstItem.length === 0) {
      firstItem = $('.itemUnit').first();
    }
    if (firstItem.length === 0) {
      firstItem = $('.yesUI_list li').first(); // YES24 리스트 아이템
    }
    if (firstItem.length === 0) {
      firstItem = $('li[class*="item"], li[class*="goods"]').first();
    }
    if (firstItem.length === 0) {
      firstItem = $('[class*="goods"], [class*="item"], [class*="product"]').first();
    }
    if (firstItem.length === 0) {
      // 검색 결과가 없거나 다른 페이지 구조인 경우
      console.log(`[YES24] No products found for: ${identifier.ean || identifier.title}`);
      console.log(`[YES24] Search URL: ${searchUrl}`);
      // 페이지 제목 확인
      const pageTitle = $('title').text();
      if (pageTitle.includes('검색') || pageTitle.includes('Search')) {
        console.log(`[YES24] 검색 페이지는 로드되었지만 결과가 없습니다.`);
      }
      return null;
    }

    // 가격 추출 (여러 선택자 시도)
    let priceText = firstItem.find('.price').first().text().trim();
    if (!priceText) {
      priceText = firstItem.find('.yes_price').first().text().trim();
    }
    if (!priceText) {
      priceText = firstItem.find('[class*="price"]').first().text().trim();
    }
    if (!priceText) {
      // 숫자만 포함된 텍스트 찾기
      const allText = firstItem.text();
      const priceMatch = allText.match(/[\d,]+원/);
      if (priceMatch) {
        priceText = priceMatch[0];
      }
    }

    const price = extractNumber(priceText);
    if (price === 0) {
      console.log(`[YES24] Could not extract price from: ${priceText}`);
      console.log(`[YES24] Item HTML: ${firstItem.html()?.substring(0, 300)}`);
      return null;
    }

    console.log(`[YES24] Found price: ${price}원 for ${identifier.ean || identifier.title}`);

    // 제품 URL 추출
    const productLink = firstItem.find('a').first().attr('href');
    const productUrl = productLink
      ? (productLink.startsWith('http') ? productLink : `https://www.yes24.com${productLink}`)
      : searchUrl;

    // 유사도 검증 (EAN 검색이 아닌 경우)
    if (!identifier.ean && identifier.title) {
      const scrapedTitle = firstItem.find('.goods_name a').text().trim() ||
        firstItem.find('.gd_name').text().trim() ||
        firstItem.find('a').first().text().trim();

      const similarity = calculateSimilarity(identifier.title, scrapedTitle);

      if (similarity < 0.2) { // 20% 미만이면 불일치로 간주
        console.log(`[YES24] ❌ Low similarity (${similarity.toFixed(2)}), discarding: "${identifier.title}" vs "${scrapedTitle}"`);
        return null;
      }
    }

    // 재고 확인
    const stockText = firstItem.find('.stock, [class*="stock"]').text().toLowerCase();
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
  } catch (error) {
    console.error('[YES24] Error:', error);
    return null;
  }
}

/**
 * 알라딘에서 LP 가격 정보 가져오기
 * EAN 또는 제품명으로 검색
 */
async function fetchAladinPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';
    if (identifier.ean) {
      searchUrl = `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=All&KeyWord=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title}`;
      searchUrl = `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=All&KeyWord=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    // 알라딘 검색 결과에서 첫 번째 제품 찾기
    let firstItem = $('.ss_book_box').first();
    if (firstItem.length === 0) {
      firstItem = $('.bookBox').first();
    }
    if (firstItem.length === 0) {
      firstItem = $('[class*="book"], [class*="item"], [class*="product"]').first();
    }
    if (firstItem.length === 0) {
      console.log(`[알라딘] No products found for: ${identifier.ean || identifier.title}`);
      console.log(`[알라딘] Search URL: ${searchUrl}`);
      return null;
    }

    // 가격 추출
    let priceText = firstItem.find('.bo_price').first().text().trim();
    if (!priceText) {
      priceText = firstItem.find('.price').first().text().trim();
    }
    if (!priceText) {
      priceText = firstItem.find('[class*="price"]').first().text().trim();
    }
    if (!priceText) {
      const allText = firstItem.text();
      const priceMatch = allText.match(/[\d,]+원/);
      if (priceMatch) {
        priceText = priceMatch[0];
      }
    }

    const price = extractNumber(priceText);
    if (price === 0) {
      console.log(`[알라딘] Could not extract price from: ${priceText}`);
      return null;
    }

    console.log(`[알라딘] Found price: ${price}원 for ${identifier.ean || identifier.title}`);

    // 제품 URL 추출
    const productLink = firstItem.find('a').first().attr('href');
    const productUrl = productLink
      ? (productLink.startsWith('http') ? productLink : `https://www.aladin.co.kr${productLink}`)
      : searchUrl;

    // 유사도 검증 (EAN 검색이 아닌 경우)
    if (!identifier.ean && identifier.title) {
      const scrapedTitle = firstItem.find('.bo3').text().trim() ||
        firstItem.find('a.bo3').text().trim() ||
        firstItem.find('a').first().text().trim();

      const similarity = calculateSimilarity(identifier.title, scrapedTitle);

      if (similarity < 0.2) {
        console.log(`[알라딘] ❌ Low similarity (${similarity.toFixed(2)}), discarding: "${identifier.title}" vs "${scrapedTitle}"`);
        return null;
      }
    }

    // 재고 확인 (알라딘은 일반적으로 재고 있음)
    const inStock = true;

    return {
      vendorName: '알라딘',
      channelId: 'mega-book',
      basePrice: price,
      shippingFee: 0,
      shippingPolicy: '5만원 이상 무료배송',
      url: productUrl,
      inStock: inStock,
    };
  } catch (error) {
    console.error('[알라딘] Error:', error);
    return null;
  }
}

/**
 * 교보문고에서 LP 가격 정보 가져오기
 * EAN 또는 제품명으로 검색
 */
async function fetchKyoboPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';
    if (identifier.ean) {
      // 교보문고 검색 URL (실제 구조 확인 필요)
      searchUrl = `https://www.kyobobook.co.kr/search/SearchKor.laf?keyword=${encodeURIComponent(identifier.ean)}&target=total`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title}`;
      searchUrl = `https://www.kyobobook.co.kr/search/SearchKor.laf?keyword=${encodeURIComponent(searchQuery)}&target=total`;
    } else {
      return null;
    }

    // 교보문고는 검색 URL이 다를 수 있음
    // 실제 검색 URL: https://www.kyobobook.co.kr/search/SearchKor.laf?keyword=...
    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    // 교보문고 검색 결과에서 첫 번째 제품 찾기
    let firstItem = $('.prod_info').first();
    if (firstItem.length === 0) {
      firstItem = $('.book_info').first();
    }
    if (firstItem.length === 0) {
      firstItem = $('.prod_item').first();
    }
    if (firstItem.length === 0) {
      firstItem = $('[class*="prod"], [class*="book"], [class*="item"]').first();
    }
    if (firstItem.length === 0) {
      console.log(`[교보문고] No products found for: ${identifier.ean || identifier.title}`);
      console.log(`[교보문고] Search URL: ${searchUrl}`);
      // 404 에러인 경우 다른 검색 방식 시도
      if (html.includes('404') || html.includes('Not Found')) {
        console.log(`[교보문고] 404 에러 - 검색 URL이 잘못되었을 수 있습니다.`);
      }
      return null;
    }

    // 가격 추출
    let priceText = firstItem.find('.price').first().text().trim();
    if (!priceText) {
      priceText = firstItem.find('.sell_price').first().text().trim();
    }
    if (!priceText) {
      priceText = firstItem.find('[class*="price"]').first().text().trim();
    }
    if (!priceText) {
      const allText = firstItem.text();
      const priceMatch = allText.match(/[\d,]+원/);
      if (priceMatch) {
        priceText = priceMatch[0];
      }
    }

    const price = extractNumber(priceText);
    if (price === 0) {
      console.log(`[교보문고] Could not extract price from: ${priceText}`);
      return null;
    }

    console.log(`[교보문고] Found price: ${price}원 for ${identifier.ean || identifier.title}`);

    // 제품 URL 추출
    const productLink = firstItem.find('a').first().attr('href');
    const productUrl = productLink
      ? (productLink.startsWith('http') ? productLink : `https://www.kyobobook.co.kr${productLink}`)
      : searchUrl;

    // 유사도 검증 (EAN 검색이 아닌 경우)
    if (!identifier.ean && identifier.title) {
      const scrapedTitle = firstItem.find('.prod_name').text().trim() ||
        firstItem.find('[class*="name"]').first().text().trim() ||
        firstItem.find('a').first().text().trim();

      const similarity = calculateSimilarity(identifier.title, scrapedTitle);

      if (similarity < 0.2) {
        console.log(`[교보문고] ❌ Low similarity (${similarity.toFixed(2)}), discarding: "${identifier.title}" vs "${scrapedTitle}"`);
        return null;
      }
    }

    // 재고 확인
    const stockText = firstItem.find('.stock, [class*="stock"]').text().toLowerCase();
    const inStock = !stockText.includes('품절') && !stockText.includes('out of stock');

    return {
      vendorName: '교보문고',
      channelId: 'mega-book',
      basePrice: price,
      shippingFee: 0,
      shippingPolicy: '5만원 이상 무료배송',
      url: productUrl,
      inStock: inStock,
    };
  } catch (error) {
    console.error('[교보문고] Error:', error);
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
    const formatNames = formats.map((f: any) => f.name?.toLowerCase() || '').join(' ');
    const isLP = formatNames.includes('lp') || formatNames.includes('vinyl') || formatNames.includes('12"');
    const isCD = formatNames.includes('cd') || formatNames.includes('compact disc');

    // CD인 경우 null 반환 (LP만 필요)
    if (isCD && !isLP) {
      console.log(`[Discogs API] CD 제품은 제외: ${data.title} (${formatNames})`);
      return null;
    }

    // 바코드 추출
    const identifiers = data.identifiers || [];
    const barcode = identifiers.find((id: any) => id.type === 'Barcode')?.value;

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
 * 네이버 스마트스토어에서 LP 가격 정보 가져오기
 * 네이버 쇼핑 API 사용 (크롤링 대신)
 */
async function fetchNaverSmartStorePrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    // 환경 변수에서 API 키 확인
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    // 디버깅: 환경 변수 확인
    if (!clientId || !clientSecret) {
      console.log('[네이버 스마트스토어] ⚠️  API 키가 없습니다.');
      console.log(`   NAVER_CLIENT_ID: ${clientId ? '있음' : '없음'}`);
      console.log(`   NAVER_CLIENT_SECRET: ${clientSecret ? '있음' : '없음'}`);
      console.log('[네이버 스마트스토어] 크롤링 시도 (봇 차단 가능)');
      return await fetchNaverShoppingCrawl(identifier);
    }

    // API 키 앞뒤 공백 제거 (혹시 모를 문제 방지)
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();

    if (!trimmedClientId || !trimmedClientSecret) {
      console.log('[네이버 스마트스토어] ⚠️  API 키가 비어있습니다.');
      return await fetchNaverShoppingCrawl(identifier);
    }

    return await fetchNaverShoppingAPI(identifier, trimmedClientId, trimmedClientSecret);
  } catch (error) {
    console.error('[네이버 스마트스토어] Error:', error);
    return null;
  }
}

/**
 * 네이버 쇼핑 API를 사용하여 가격 정보 가져오기
 */
async function fetchNaverShoppingAPI(
  identifier: ProductIdentifier,
  clientId: string,
  clientSecret: string
): Promise<VendorOffer | null> {
  try {
    // 검색어 구성 - 여러 전략 시도
    const searchQueries: string[] = [];

    if (identifier.ean) {
      // EAN만으로는 LP를 찾기 어려울 수 있으므로 제목+아티스트도 함께 시도
      searchQueries.push(identifier.ean);
    }

    if (identifier.title && identifier.artist) {
      // 다양한 검색어 조합 시도
      searchQueries.push(`${identifier.artist} ${identifier.title} LP`);
      searchQueries.push(`${identifier.artist} ${identifier.title} 바이닐`);
      searchQueries.push(`${identifier.artist} ${identifier.title} 레코드`);
      searchQueries.push(`${identifier.title} ${identifier.artist} LP`);
    }

    if (searchQueries.length === 0) {
      console.log(`[네이버 쇼핑 API] 검색어를 구성할 수 없음`);
      return null;
    }

    // 첫 번째 검색어로 시도
    let query = searchQueries[0];
    const apiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10&sort=asc`;

    console.log(`[네이버 쇼핑 API] 검색 중: ${query}`);
    console.log(`[네이버 쇼핑 API] 시도할 검색어들: ${searchQueries.join(', ')}`);

    const response = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[네이버 쇼핑 API] HTTP ${response.status}: ${errorText}`);

      // 401 에러인 경우 상세 정보 출력
      if (response.status === 401) {
        console.log(`\n[네이버 쇼핑 API] ❌ 인증 실패 (HTTP 401)`);
        console.log(`   에러 메시지: ${errorText}`);
        console.log(`\n   🔍 다음을 확인해주세요:\n`);
        console.log(`   1. 네이버 개발자 센터(https://developers.naver.com/) 접속`);
        console.log(`   2. 내 애플리케이션 → 해당 애플리케이션 선택`);
        console.log(`   3. "API 설정" 탭에서 "네이버 쇼핑 API"가 ✅ 활성화되어 있는지 확인`);
        console.log(`      ❌ 비활성화되어 있다면 "활성화" 버튼 클릭`);
        console.log(`   4. "비로그인 오픈 API 서비스 환경"이 "WEB"으로 설정되어 있는지 확인`);
        console.log(`   5. .env 파일의 Client ID와 Secret이 네이버 개발자 센터의 값과 일치하는지 확인`);
        console.log(`   6. .env 파일에 공백이나 따옴표가 없는지 확인`);
        console.log(`\n   현재 설정된 Client ID: ${clientId ? clientId.substring(0, 8) + '...' + clientId.substring(clientId.length - 4) : '없음'}`);
        console.log(`   Client ID 길이: ${clientId?.length || 0}자`);
        console.log(`   Client Secret 길이: ${clientSecret?.length || 0}자\n`);
      }
      return null;
    }

    const data = await response.json();

    // 디버깅: 전체 응답 구조 확인
    console.log(`[네이버 쇼핑 API] 응답 구조:`, {
      total: data.total,
      start: data.start,
      display: data.display,
      itemsCount: data.items?.length || 0,
    });

    if (!data.items || data.items.length === 0) {
      console.log(`[네이버 쇼핑 API] 검색 결과 없음: ${query}`);
      console.log(`[네이버 쇼핑 API] 전체 검색어 목록: ${searchQueries.join(', ')}`);

      // 다른 검색어들도 시도
      for (let i = 1; i < searchQueries.length; i++) {
        const altQuery = searchQueries[i];
        console.log(`[네이버 쇼핑 API] 대체 검색어 시도: ${altQuery}`);

        const altApiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(altQuery)}&display=10&sort=asc`;
        const altResponse = await fetch(altApiUrl, {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        });

        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (altData.items && altData.items.length > 0) {
            // CD 필터링
            const lpItems = altData.items.filter((item: any) => {
              const title = (item.title || '').toLowerCase();
              const category = (item.category1 || '').toLowerCase() + ' ' + (item.category2 || '').toLowerCase();
              // CD 관련 키워드 제외
              const isCD = title.includes('cd') || title.includes('compact disc') ||
                title.includes('[수입cd]') || title.includes('[cd]') ||
                category.includes('cd') || category.includes('compact disc');
              // LP 관련 키워드 포함
              const isLP = title.includes('lp') || title.includes('vinyl') || title.includes('바이닐') ||
                title.includes('레코드') || title.includes('판') ||
                category.includes('lp') || category.includes('vinyl');

              return !isCD && (isLP || !title.includes('cd')); // CD가 아니고 LP이거나 CD 키워드가 없어야 함
            });

            if (lpItems.length > 0) {
              console.log(`[네이버 쇼핑 API] 대체 검색어로 LP 결과 발견: ${altQuery} (CD ${altData.items.length - lpItems.length}개 제외)`);
              const item = lpItems[0];
              const price = parseInt(item.lprice) || parseInt(item.hprice);

              if (price && price > 0) {
                console.log(`[네이버 쇼핑 API] ✅ ${item.mallName || '네이버 쇼핑'}: ${price.toLocaleString()}원`);
                return {
                  vendorName: item.mallName || '네이버 쇼핑',
                  channelId: 'omni-mall',
                  basePrice: price,
                  shippingFee: 0,
                  shippingPolicy: '배송비 별도',
                  url: item.link,
                  inStock: true,
                  affiliateCode: 'itsmyturn',
                  affiliateParamKey: 'trackingId',
                };
              }
            } else {
              console.log(`[네이버 쇼핑 API] 대체 검색어 결과는 모두 CD: ${altQuery}`);
            }
          }
        }

        // API 호출 간 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return null;
    }

    // CD 필터링 - LP만 선택
    const lpItems = data.items.filter((item: any) => {
      const title = (item.title || '').toLowerCase();
      const category = (item.category1 || '').toLowerCase() + ' ' + (item.category2 || '').toLowerCase();

      // CD 관련 키워드 제외
      const isCD = title.includes('cd') || title.includes('compact disc') ||
        title.includes('[수입cd]') || title.includes('[cd]') ||
        category.includes('cd') || category.includes('compact disc');

      // LP 관련 키워드 포함
      const isLP = title.includes('lp') || title.includes('vinyl') || title.includes('바이닐') ||
        title.includes('레코드') || title.includes('판') ||
        category.includes('lp') || category.includes('vinyl');

      return !isCD && (isLP || !title.includes('cd')); // CD가 아니고 LP이거나 CD 키워드가 없어야 함
    });

    if (lpItems.length === 0) {
      console.log(`[네이버 쇼핑 API] 검색 결과는 모두 CD입니다: ${query} (총 ${data.items.length}개 중 0개 LP)`);

      // 다른 검색어들도 시도
      for (let i = 1; i < searchQueries.length; i++) {
        const altQuery = searchQueries[i];
        console.log(`[네이버 쇼핑 API] 대체 검색어 시도: ${altQuery}`);

        const altApiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(altQuery)}&display=10&sort=asc`;
        const altResponse = await fetch(altApiUrl, {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        });

        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (altData.items && altData.items.length > 0) {
            const altLpItems = altData.items.filter((item: any) => {
              const title = (item.title || '').toLowerCase();
              const category = (item.category1 || '').toLowerCase() + ' ' + (item.category2 || '').toLowerCase();
              const isCD = title.includes('cd') || title.includes('compact disc') ||
                title.includes('[수입cd]') || title.includes('[cd]') ||
                category.includes('cd') || category.includes('compact disc');
              const isLP = title.includes('lp') || title.includes('vinyl') || title.includes('바이닐') ||
                title.includes('레코드') || title.includes('판') ||
                category.includes('lp') || category.includes('vinyl');
              return !isCD && (isLP || !title.includes('cd'));
            });

            if (altLpItems.length > 0) {
              console.log(`[네이버 쇼핑 API] 대체 검색어로 LP 결과 발견: ${altQuery}`);
              const item = altLpItems[0];
              const price = parseInt(item.lprice) || parseInt(item.hprice);

              if (price && price > 0) {
                console.log(`[네이버 쇼핑 API] ✅ ${item.mallName || '네이버 쇼핑'}: ${price.toLocaleString()}원`);
                return {
                  vendorName: item.mallName || '네이버 쇼핑',
                  channelId: 'omni-mall',
                  basePrice: price,
                  shippingFee: 0,
                  shippingPolicy: '배송비 별도',
                  url: item.link,
                  inStock: true,
                  affiliateCode: 'itsmyturn',
                  affiliateParamKey: 'trackingId',
                };
              }
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return null;
    }

    console.log(`[네이버 쇼핑 API] LP 필터링 결과: ${lpItems.length}개 LP (총 ${data.items.length}개 중)`);

    // 첫 번째 LP 결과 사용 (가격 오름차순 정렬했으므로 최저가)
    const item = lpItems[0];
    console.log(`[네이버 쇼핑 API] 첫 번째 LP 결과:`, {
      title: item.title,
      mallName: item.mallName,
      lprice: item.lprice,
      hprice: item.hprice,
      link: item.link,
    });

    const price = parseInt(item.lprice) || parseInt(item.hprice);

    if (!price || price === 0) {
      console.log(`[네이버 쇼핑 API] 가격 정보 없음 (lprice: ${item.lprice}, hprice: ${item.hprice})`);

      // 다른 LP 결과들도 확인
      for (let i = 1; i < Math.min(lpItems.length, 5); i++) {
        const altItem = lpItems[i];
        const altPrice = parseInt(altItem.lprice) || parseInt(altItem.hprice);
        console.log(`[네이버 쇼핑 API] LP 결과 ${i + 1}: ${altItem.title} - ${altPrice.toLocaleString()}원`);
        if (altPrice && altPrice > 0) {
          console.log(`[네이버 쇼핑 API] ✅ 대체 LP 결과 사용: ${altItem.mallName || '네이버 쇼핑'}: ${altPrice.toLocaleString()}원`);
          return {
            vendorName: altItem.mallName || '네이버 쇼핑',
            channelId: 'omni-mall',
            basePrice: altPrice,
            shippingFee: 0,
            shippingPolicy: '배송비 별도',
            url: altItem.link,
            inStock: true,
            affiliateCode: 'itsmyturn',
            affiliateParamKey: 'trackingId',
          };
        }
      }

      return null;
    }

    console.log(`[네이버 쇼핑 API] ✅ ${item.mallName || '네이버 쇼핑'}: ${price.toLocaleString()}원`);

    return {
      vendorName: item.mallName || '네이버 쇼핑',
      channelId: 'omni-mall',
      basePrice: price,
      shippingFee: 0, // API에서 제공하지 않으므로 별도 확인 필요
      shippingPolicy: '배송비 별도',
      url: item.link,
      inStock: true,
      affiliateCode: 'itsmyturn',
      affiliateParamKey: 'trackingId',
    };
  } catch (error) {
    console.error('[네이버 쇼핑 API] Error:', error);
    if (error instanceof Error) {
      console.error('[네이버 쇼핑 API] Error message:', error.message);
      console.error('[네이버 쇼핑 API] Error stack:', error.stack);
    }
    return null;
  }
}

/**
 * 네이버 쇼핑 크롤링 (API 키가 없을 때만 사용)
 */
async function fetchNaverShoppingCrawl(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';
    if (identifier.ean) {
      searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title} LP`;
      searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    // 네이버 쇼핑은 봇 차단이 심함 (HTTP 418)
    try {
      const html = await fetchWithRetry(searchUrl);
      const $ = cheerio.load(html);

      // 네이버 쇼핑 검색 결과에서 첫 번째 제품 찾기
      let firstItem = $('.product_item').first();
      if (firstItem.length === 0) {
        firstItem = $('.basicList_item').first();
      }
      if (firstItem.length === 0) {
        firstItem = $('[class*="product"], [class*="item"]').first();
      }
      if (firstItem.length === 0) {
        console.log(`[네이버 스마트스토어] No products found for: ${identifier.ean || identifier.title}`);
        return null;
      }

      // 가격 추출
      let priceText = firstItem.find('.price').first().text().trim();
      if (!priceText) {
        priceText = firstItem.find('.price_num').first().text().trim();
      }
      if (!priceText) {
        priceText = firstItem.find('[class*="price"]').first().text().trim();
      }
      if (!priceText) {
        const allText = firstItem.text();
        const priceMatch = allText.match(/[\d,]+원/);
        if (priceMatch) {
          priceText = priceMatch[0];
        }
      }

      const price = extractNumber(priceText);
      if (price === 0) {
        console.log(`[네이버 스마트스토어] Could not extract price`);
        return null;
      }

      // 제품 URL 추출
      const productLink = firstItem.find('a').first().attr('href');
      const productUrl = productLink
        ? (productLink.startsWith('http') ? productLink : `https://shopping.naver.com${productLink}`)
        : searchUrl;

      // 배송 정보 추출
      const shippingText = firstItem.find('.delivery, [class*="delivery"]').text().toLowerCase();
      const shippingPolicy = shippingText.includes('무료') ? '무료배송' : '배송비 별도';

      return {
        vendorName: '네이버 스마트스토어',
        channelId: 'omni-mall',
        basePrice: price,
        shippingFee: shippingText.includes('무료') ? 0 : 3000,
        shippingPolicy: shippingPolicy,
        url: productUrl,
        inStock: true,
        affiliateCode: 'itsmyturn',
        affiliateParamKey: 'trackingId',
      };
    } catch (error: any) {
      // HTTP 418 (I'm a teapot) - 봇 차단
      if (error.message?.includes('418')) {
        console.log(`[네이버 스마트스토어] 봇 차단됨 (HTTP 418) - API 사용 권장`);
        return null;
      }
      throw error;
    }
  } catch (error) {
    console.error('[네이버 스마트스토어] Error:', error);
    return null;
  }
}

/**
 * 쿠팡에서 LP 가격 정보 가져오기
 * 주의: 쿠팡은 JavaScript 렌더링이 필요할 수 있어 크롤링이 어려울 수 있습니다.
 */
async function fetchCoupangPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';
    if (identifier.ean) {
      searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title} LP`;
      searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    // 쿠팡은 봇 차단이 심함 (HTTP 403) 및 JavaScript 렌더링 필요
    let html: string;
    try {
      html = await fetchWithRetry(searchUrl);
    } catch (error: any) {
      // HTTP 403 (Forbidden) - 봇 차단
      if (error.message?.includes('403')) {
        console.log(`[쿠팡] 봇 차단됨 (HTTP 403) - puppeteer 필요할 수 있음`);
        return null;
      }
      throw error;
    }

    const $ = cheerio.load(html);

    // 쿠팡 검색 결과에서 첫 번째 제품 찾기
    const firstItem = $('.search-product, .baby-product, [class*="product"]').first();
    if (firstItem.length === 0) {
      // JavaScript 렌더링이 필요한 경우 null 반환
      console.log(`[쿠팡] No products found (may require JS rendering) for: ${identifier.ean || identifier.title}`);
      return null;
    }

    // 가격 추출
    const priceText = firstItem.find('.price-value, .price, [class*="price"]').first().text().trim();
    const price = extractNumber(priceText);
    if (price === 0) {
      console.log(`[쿠팡] Could not extract price from: ${priceText}`);
      return null;
    }

    // 제품 URL 추출
    const productLink = firstItem.find('a').first().attr('href');
    const productUrl = productLink
      ? (productLink.startsWith('http') ? productLink : `https://www.coupang.com${productLink}`)
      : searchUrl;

    return {
      vendorName: '쿠팡',
      channelId: 'omni-mall',
      basePrice: price,
      shippingFee: 0,
      shippingPolicy: '로켓배송',
      url: productUrl,
      inStock: true,
    };
  } catch (error) {
    console.error('[쿠팡] Error:', error);
    return null;
  }
}

/**
 * 11번가에서 LP 가격 정보 가져오기
 */
async function fetch11stPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';
    if (identifier.ean) {
      searchUrl = `https://search.11st.co.kr/Search.tmall?kwd=${encodeURIComponent(identifier.ean)}`;
    } else if (identifier.title && identifier.artist) {
      const searchQuery = `${identifier.artist} ${identifier.title} LP`;
      searchUrl = `https://search.11st.co.kr/Search.tmall?kwd=${encodeURIComponent(searchQuery)}`;
    } else {
      return null;
    }

    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    // 11번가 검색 결과에서 첫 번째 제품 찾기
    const firstItem = $('.c_card, .card, [class*="product"]').first();
    if (firstItem.length === 0) {
      console.log(`[11번가] No products found for: ${identifier.ean || identifier.title}`);
      return null;
    }

    // 가격 추출
    const priceText = firstItem.find('.price, .prc, [class*="price"]').first().text().trim();
    const price = extractNumber(priceText);
    if (price === 0) {
      console.log(`[11번가] Could not extract price from: ${priceText}`);
      return null;
    }

    // 제품 URL 추출
    const productLink = firstItem.find('a').first().attr('href');
    const productUrl = productLink
      ? (productLink.startsWith('http') ? productLink : `https://www.11st.co.kr${productLink}`)
      : searchUrl;

    // 배송 정보 추출
    const shippingText = firstItem.find('.delivery, [class*="delivery"]').text().toLowerCase();
    const shippingPolicy = shippingText.includes('무료') ? '무료배송' : '배송비 별도';

    return {
      vendorName: '11번가',
      channelId: 'omni-mall',
      basePrice: price,
      shippingFee: shippingText.includes('무료') ? 0 : 3000,
      shippingPolicy: shippingPolicy,
      url: productUrl,
      inStock: true,
    };
  } catch (error) {
    console.error('[11번가] Error:', error);
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
    } catch (error) {
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
    } catch (error) {
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
    naver, coupang, st11,
    hyang, kimbap, majang
  ] = await Promise.all([
    // 1. 대형 서점
    fetchYes24Price(finalIdentifier),
    fetchAladinPrice(finalIdentifier),
    fetchKyoboPrice(finalIdentifier),
    fetchInterparkPrice(finalIdentifier),
    // 2. 종합몰
    fetchNaverSmartStorePrice(finalIdentifier),
    fetchCoupangPrice(finalIdentifier),
    fetch11stPrice(finalIdentifier),
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
    { name: '쿠팡', data: coupang },
    { name: '11번가', data: st11 },
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

  console.log(`[가격 수집] 총 ${offers.length}개의 가격 정보를 찾았습니다.`);
  return offers;
}

/**
 * 제품의 가격 정보 업데이트
 */
async function updateProductOffers(productId: string, offers: VendorOffer[]) {
  // 기존 offers 삭제
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
    // 모든 제품 가져오기 (EAN, Discogs ID, 제목, 아티스트 포함)
    const { data: products, error } = await supabase
      .from('lp_products')
      .select('id, ean, discogs_id, title, artist');

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

