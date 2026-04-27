/**
 * Vercel Serverless Function for On-Demand Price Search
 * 
 * Edge Function 대신 Vercel Serverless Function 사용
 * 더 간단하고 안정적인 배포
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';


// CORS 헤더는 jsonResponse 함수에서 처리

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // CORS preflight 처리
  if (request.method === 'OPTIONS') {
    return response.status(200).setHeader('Access-Control-Allow-Origin', '*').setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS').setHeader('Access-Control-Allow-Headers', 'Content-Type').json({ ok: true });
  }

  // POST만 허용
  if (request.method !== 'POST') {
    return response.status(405).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Method not allowed' });
  }

  // 모든 응답에 CORS 헤더 추가하는 헬퍼
  const jsonResponse = (status: number, data: Record<string, unknown>) => {
    return response.status(status)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .json(data);
  };

  try {
    // Vercel Serverless Function 환경 변수 가져오기
    // 🚨 중요: 기존 SUPABASE_URL이 잘못된 옛날 프로젝트 DB를 가리키고 있어서 VITE_ 변수를 최우선으로 선언합니다.
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // 서버 로그에만 디버깅 정보 기록 (클라이언트에 노출하지 않음)
      console.error('[가격 검색 API] ❌ Supabase 환경 변수 없음:', {
        hasUrl: !!process.env.SUPABASE_URL,
        hasViteUrl: !!process.env.VITE_SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasViteKey: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      });

      return jsonResponse(500, {
        error: 'Supabase credentials not configured',
        hint: 'Vercel 대시보드 > Settings > Environment Variables에서 설정이 필요합니다.',
      });
    }

    // Service Role Key로 Supabase 클라이언트 생성 (RLS 우회)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Supabase 연결 테스트 (테이블 존재 확인) - 실패해도 계속 진행
    let dbAvailable = false;
    try {
      console.log('[가격 검색 API] Supabase 연결 테스트 시작...');
      const { data, error: testError } = await supabase
        .from('lp_products')
        .select('id')
        .limit(1);

      if (testError) {
        console.warn('[가격 검색 API] ⚠️ Supabase 테이블 접근 불가 (가격 검색은 계속 진행):', {
          code: testError.code,
          message: testError.message,
        });
        dbAvailable = false;
      } else {
        console.log('[가격 검색 API] ✅ Supabase 연결 성공, 테이블 접근 가능');
        dbAvailable = true;
      }
    } catch (testErr: any) {
      console.warn('[가격 검색 API] ⚠️ Supabase 연결 테스트 실패 (가격 검색은 계속 진행):', testErr.message);
      dbAvailable = false;
    }

    const { productId, artist, title, ean, discogsId, forceRefresh, vendor } = request.body;

    // 파라미터 검증
    if (!productId && (!artist || !title)) {
      return jsonResponse(400, {
        error: 'productId 또는 (artist + title)이 필요합니다.'
      });
    }

    let identifier = { ean, discogsId, title, artist, vendor };

    // 1. 제품 ID가 있으면 DB에서 제품 정보 가져오기 (없어도 계속 진행)
    if (productId) {
      try {
        const { data, error } = await supabase
          .from('lp_products')
          .select('id, ean, discogs_id, title, artist')
          .eq('id', productId)
          .single();

        if (error) {
          console.warn('[가격 검색 API] ⚠️ 제품 조회 실패 (계속 진행):', error.message);
          // 제품 조회 실패해도 artist/title로 계속 진행
        } else if (data) {
          identifier = {
            ean: data.ean || ean,
            discogsId: data.discogs_id || discogsId,
            title: data.title || title,
            artist: data.artist || artist,
            vendor: vendor,
          };
        }
      } catch (err: any) {
        console.warn('[가격 검색 API] ⚠️ 제품 조회 예외 (계속 진행):', err.message);
      }
    }

    // 2. 캐시 확인 (24시간 이내 데이터) - productId가 있고 DB가 사용 가능할 때만
    if (!forceRefresh && productId && dbAvailable) {
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: cachedOffers, error: offersError } = await supabase
          .from('lp_offers')
          .select('*')
          .eq('product_id', productId)
          .gte('last_checked', oneDayAgo)
          .order('base_price', { ascending: true });

        if (offersError) {
          console.warn('[가격 검색 API] ⚠️ 캐시 조회 오류 (무시하고 계속):', offersError.message);
        } else if (cachedOffers && cachedOffers.length > 0) {
          const offers = cachedOffers.map((o: any) => ({
            vendorName: o.vendor_name,
            channelId: o.channel_id,
            basePrice: o.base_price,
            shippingFee: o.shipping_fee || 0,
            shippingPolicy: o.shipping_policy || '',
            url: o.url,
            inStock: o.is_stock_available,
            affiliateCode: o.affiliate_code,
            affiliateParamKey: o.affiliate_param_key,
          }));

          return jsonResponse(200, {
            offers,
            cached: true,
            searchTime: 0,
            productId,
          });
        }
      } catch (cacheErr: any) {
        console.warn('[가격 검색 API] ⚠️ 캐시 확인 예외 (계속 진행):', cacheErr.message);
      }
    }

    // 3. 실시간 가격 검색
    console.log(`[가격 검색 API] 검색 시작:`, JSON.stringify(identifier, null, 2));

    // identifier 검증
    if (!identifier.artist || !identifier.title) {
      return jsonResponse(400, {
        error: 'Missing required fields',
        message: 'artist and title are required for price search',
        identifier,
      });
    }

    const searchStartTime = Date.now();

    let offers: any[] = [];
    let searchTime = 0;
    try {
      offers = await collectPricesForProduct(identifier);
      searchTime = parseFloat(((Date.now() - searchStartTime) / 1000).toFixed(2));
      console.log(`[가격 검색 API] 검색 완료: ${offers.length}개 (${searchTime}초)`);
      if (offers.length === 0) {
        console.log(`[가격 검색 API] ⚠️ 결과 없음 - 검색 쿼리나 필터링 문제 가능성`);
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[가격 검색 API] ❌ 검색 오류:`, {
        message: err.message,
        stack: err.stack,
        name: err.name,
        identifier,
      });
      return jsonResponse(500, {
        error: 'Price search failed',
        message: err.message || 'Unknown error during price search',
        errorName: err.name,
        identifier,
      });
    }

    // 4. 검색 결과를 DB에 저장 (제품이 있고 offers가 있고 DB가 사용 가능할 때만)
    if (productId && dbAvailable) {
      try {
        // 기존 offers 업데이트를 위해 삭제 (vendor가 지정된 경우 해당 채널만 삭제)
        let deleteQuery: any = supabase.from('lp_offers').delete().eq('product_id', productId);

        let targetChannel = identifier.vendor;
        if (!targetChannel && offers.length > 0) {
          targetChannel = offers[0].channelId || offers[0].vendorName;
        }

        if (targetChannel) {
          const channelMap: Record<string, string> = {
            'naver': 'naver',
            'aladin': 'aladin',
            'yes24': 'yes24',
            'kyobo': 'kyobo',
            'gimbab': 'gimbab'
          };
          const mappedChannel = channelMap[targetChannel] || targetChannel;
          deleteQuery = deleteQuery.eq('channel_id', mappedChannel);
        } else {
          deleteQuery = null;
        }

        if (deleteQuery) {
          const { error: deleteError } = await deleteQuery;
          if (deleteError) {
            console.error('[가격 검색 API] ⚠️ 기존 오퍼 삭제 오류:', deleteError);
          }
        }

        // 새 offers 삽입
        if (offers.length > 0) {
          const offersToInsert = offers.map(offer => ({
            product_id: productId,
            vendor_name: offer.vendorName,
            channel_id: offer.channelId || targetChannel,
            price: offer.basePrice,
            base_price: offer.basePrice,
            currency: 'KRW',
            shipping_fee: offer.shippingFee || 0,
            shipping_policy: offer.shippingPolicy || '',
            url: offer.url,
            affiliate_url: null,
            is_stock_available: offer.inStock ?? true,
            last_checked: new Date().toISOString(),
            badge: null,
          }));

          const { error: insertError } = await supabase
            .from('lp_offers')
            .insert(offersToInsert);

          if (insertError) {
            console.error('[가격 검색 API] ⚠️ 새 오퍼 삽입 오류:', insertError);
          }
        }

        // 제품의 last_synced_at 업데이트
        await supabase
          .from('lp_products')
          .update({
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId);
      } catch (saveErr: any) {
        console.warn('[가격 검색 API] ⚠️ DB 저장 실패 (결과는 반환):', saveErr.message);
        // 저장 실패해도 검색 결과는 반환
      }
    }

    return jsonResponse(200, {
      offers,
      cached: false,
      searchTime,
      productId: productId || null,
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[가격 검색 오류]', err);
    return jsonResponse(500, {
      error: err.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}


// --- INLINED LIB ---

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

function isValidLpMatch(foundTitle: string, identifier: ProductIdentifier, skipLpKeyword = false): boolean {
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
      // 띄어쓰기 무시 fallback: "환상의나라" vs "환상의 나라"
      const squishAlbum = albumTokens.join('');
      const squishTitle = tokenize(lowerTitle).join('');
      if (!squishTitle.includes(squishAlbum)) return false;
      albumMatchCount = albumTokens.length;
    }
  }

  const totalTokens = artistTokens.length + albumTokens.length;
  const matchCount = artistMatchCount + albumMatchCount;
  // 전체 토큰 중에서도 40%는 매칭되어야 함
  const requiredMatches = Math.max(1, Math.floor(totalTokens * 0.4));

  if (matchCount < requiredMatches) {
    return false;
  }

  // 타이틀에 LP/vinyl 관련 키워드가 하나라도 있어야 통과 (CD 등 필터링)
  // skipLpKeyword: 번개장터처럼 쿼리에 이미 LP가 포함된 경우 면제
  if (!skipLpKeyword) {
    const hasLpKeyword = ['lp', 'vinyl', '바이닐'].some(k => lowerTitle.includes(k));
    if (!hasLpKeyword) return false;
  }

  // Find extra un-matched tokens to penalize completely different albums in a franchise
  const allowedExtraTokens = new Set([
    'lp', 'vinyl', '바이닐', '비닐', 'ost', 'soundtrack', '사운드트랙', '오에스티', 'gatefold', 'remastered', 'edition', 'anniversary',
    'color', 'coloured', 'colored', '컬러', '음반', '수입', '수입반', '한정반', '투명', '블랙', '화이트', '레드', '블루', '한정',
    '투명컬러', '2lp', '3lp', '180g', '140g', '레코드', 'record', 'records', 'vol', 'pt', 'part', 'the', 'of', 'and', 'in', 'a', 'to', 'for', 'with', 'on', 'at', 'by', 'original', 'motion', 'picture', 'score',
    '영화', '미국', '발송', '해외', '배송', '정품', '미개봉', '새상품', 'music', '뮤직', '앨범', 'album', 'sealed', 'new', 'mint',
    '오리지널', 'composer', '작곡', '지휘',
    'kpop', 'k-pop', 'signed', 'hand', 'd2c', 'in',
    '초판', '중고', '미개봉',
    // 컬러/변형 관련
    'clear', 'splatter', 'mix', '클리어', '옐로우', '그린', '핑크', '오렌지', '퍼플', '골드', '실버', '마블',
    'yellow', 'green', 'pink', 'orange', 'purple', 'gold', 'silver', 'marble', 'marbled', 'blue', 'red', 'white', 'black',
    // 판매 사이트 문구
    '주문', '당일', '출고', '주문당일출고', '이전', '15시이전', '3집', '4집', '5집', '6집', '7집', '1집', '2집', '정규',
    'limited', 'deluxe', 'special', 'standard', 'pressing', 'repress', 'reissue', 'import',
  ]);

  let extraSubstantiveCount = 0;
  for (const token of titleTokens) { // Using the leftover tokens after splice
    if (!allowedExtraTokens.has(token) && isNaN(Number(token))) {
      extraSubstantiveCount++;
    }
  }

  // Extra token penalty: 짧은 타이틀은 엄격하게, 긴 타이틀은 여유 있게
  const maxAllowedExtra = Math.max(2, Math.floor(albumTokens.length * 0.8));
  if (extraSubstantiveCount > maxAllowedExtra) {
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
  return price >= 15000;
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
          shippingFee: 0, // 네이버 검색 API는 배송비를 정확히 반환하지 않음
          shippingPolicy: '상세정보 확인',
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

  // fallback: LP 키워드 없이 재검색 (네이버에서 LP 안 붙은 결과가 더 많은 경우)
  if (offers.length === 0) {
    const fallbackQuery = `${identifier.artist} ${identifier.title} 바이닐`;
    offers = await searchNaver(fallbackQuery);
  }

  return offers;
}

async function fetchAladinPrice(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const aladinTtbKey = process.env.ALADIN_TTB_KEY;
  if (!aladinTtbKey) return [];

  const searchAladin = async (query: string, target: 'Music' | 'Used' = 'Music') => {
    try {
      const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinTtbKey}&QueryType=Keyword&Query=${encodeURIComponent(query)}&MaxResults=5&start=1&SearchTarget=${target}&Output=JS&Version=20131101`;
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
  const keywordQuery = `${identifier.artist} ${identifier.title} LP`;

  let newOffers: VendorOffer[] = [];
  if (cleanEan) {
    newOffers = await searchAladin(cleanEan, 'Music');
  }
  if (newOffers.length === 0) {
    newOffers = await searchAladin(keywordQuery, 'Music');
  }

  let usedOffers: VendorOffer[] = [];
  if (cleanEan) {
    usedOffers = await searchAladin(cleanEan, 'Used');
  }
  if (usedOffers.length === 0) {
    usedOffers = await searchAladin(keywordQuery, 'Used');
  }

  return [...newOffers, ...usedOffers];
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
        if (tagsRaw.includes('절판')) status.badge = 'out-of-print';

        const isYes24Oos = item.find('.soldOut, .shortV').length > 0;
        const inStock = price > 0 && !isYes24Oos;
        if (link.includes('UsedShopHub') || link.includes('used')) {
          status.badge = 'used';
        }

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

        // In Kyobo, if there is a price it usually means it can be bought, but they have a state div just in case
        const status = parseStatusFlags(title);

        const kyoboStateDiv = item.find('.prod_purchase_state, .badge_inner span').text();
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

async function fetchGimbabPrice(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  const searchGimbab = async (query: string) => {
    try {
      const url = `https://gimbabrecords.com/product/search.html?keyword=${encodeURIComponent(query)}`;
      const html = await fetchWithRetry(url);
      if (!html) return [];

      const $ = cheerio.load(html);
      const offers: VendorOffer[] = [];

      $('.prdList > li, .xans-search-list > li').slice(0, 5).each((_, el) => {
        const item = $(el);
        const title = item.find('strong.name a').text().trim() || item.find('.name a').text().trim() || item.find('.name').text().trim();

        let priceText = item.find('li[rel="판매가"] span').text().trim();
        if (!priceText) priceText = item.find('ul.spec li span').first().text().trim();
        if (!priceText) priceText = item.find('.price').text().trim();

        const price = extractNumber(priceText);
        const link = item.find('a').attr('href');

        if (!title || !link || !isValidPrice(price)) return;
        if (!isValidLpMatch(title, identifier)) return;

        const status = parseStatusFlags(title);
        const isGimbabOos = item.find('img[alt="품절"]').length > 0 || item.find('.icon_img img[alt="품절"]').length > 0;
        const inStock = price > 0 && !isGimbabOos;

        offers.push({
          vendorName: '김밥레코즈',
          channelId: 'gimbab',
          basePrice: price,
          shippingFee: 0,
          shippingPolicy: '조건부 무료',
          url: link.startsWith('http') ? link : `https://gimbabrecords.com${link}`,
          inStock,
          badge: status.badge,
        });
      });
      return offers;
    } catch (e) { return []; }
  };

  const keywordQuery = `${identifier.artist} ${identifier.title} LP`;
  return await searchGimbab(keywordQuery);
}

async function fetchBunjangPrice(identifier: ProductIdentifier): Promise<VendorOffer[]> {
  try {
    const query = `${identifier.artist} ${identifier.title} LP`;
    const url = `https://api.bunjang.co.kr/api/1/find_v2.json?q=${encodeURIComponent(query)}&order=score&page=0&n=30&stat_device=w&stat_category_required=1&req_ref=search&version=5`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Origin': 'https://m.bunjang.co.kr',
        'Referer': 'https://m.bunjang.co.kr/',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data.list || [];

    // 1단계: 검색 결과 필터링
    const validItems: any[] = [];
    for (const item of items) {
      const title = item.name || '';
      const price = parseInt(item.price, 10);
      if (!isValidPrice(price)) continue;
      if (item.status !== '0') continue; // 0 = 판매중
      if (['구매', '구함', '구합', '삽니다', '구인', '구해요'].some(k => title.includes(k))) continue;
      if (!isValidLpMatch(title, identifier, true)) continue;
      validItems.push(item);
      if (validItems.length >= 8) break; // 상위 8개만 상세 조회
    }

    // 2단계: 상세 API로 상점명 + 배송비 가져오기 (병렬, 최대 8개)
    const detailHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://m.bunjang.co.kr',
      'Referer': 'https://m.bunjang.co.kr/',
    };

    const offers: VendorOffer[] = [];

    const detailPromises = validItems.map(async (item) => {
      const price = parseInt(item.price, 10);
      let shopName = '번개장터';
      let shippingFee = 0;
      let shippingText = item.free_shipping ? '무료배송' : '택배';
      let condition: 'used' | null = 'used'; // 기본값: 중고

      try {
        const detailCtrl = new AbortController();
        const detailTimeout = setTimeout(() => detailCtrl.abort(), 4000);
        const detailRes = await fetch(
          `https://api.bunjang.co.kr/api/pms/v3/products-detail/${item.pid}?viewerUid=-1`,
          { headers: detailHeaders, signal: detailCtrl.signal }
        );
        clearTimeout(detailTimeout);

        if (detailRes.ok) {
          const detail = await detailRes.json();
          const d = detail.data;

          // 상점명
          if (d?.shop?.name) {
            shopName = d.shop.name;
          }

          // 배송비
          const trade = d?.product?.trade;
          if (trade) {
            if (trade.freeShipping) {
              shippingFee = 0;
              shippingText = '무료배송';
            } else if (trade.shippingSpecs?.DEFAULT?.fee) {
              shippingFee = parseInt(trade.shippingSpecs.DEFAULT.fee, 10) || 0;
              shippingText = '택배';
            }
          }

          // 상품 상태 (NEW이면 중고 뱃지 제거)
          if (d?.product?.condition === 'NEW') {
            condition = null;
          }
        }
      } catch {
        // 상세 조회 실패 시 검색 결과의 기본값 사용
      }

      return {
        vendorName: shopName,
        channelId: 'bunjang' as const,
        basePrice: price,
        shippingFee,
        shippingPolicy: shippingText,
        url: `https://bunjang.co.kr/products/${item.pid}`,
        inStock: true,
        ...(condition && { badge: condition }),
      };
    });

    const results = await Promise.allSettled(detailPromises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        offers.push(result.value as VendorOffer);
      }
    }

    return offers;
  } catch (e) { return []; }
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
  } else if (vendor === 'gimbab') {
    return await fetchGimbabPrice(identifier);
  } else if (vendor === 'bunjang') {
    return await fetchBunjangPrice(identifier);
  } else {
    const results = await Promise.allSettled([
      fetchNaverPrice(identifier),
      fetchAladinPrice(identifier),
      fetchYes24Price(identifier),
      fetchKyoboPrice(identifier),
      fetchGimbabPrice(identifier),
      fetchBunjangPrice(identifier),
    ]);
    for (const res of results) {
      if (res.status === 'fulfilled') offers.push(...res.value);
    }
  }

  return offers;
}
