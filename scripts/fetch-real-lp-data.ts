/**
 * 실제 LP 데이터 크롤링 스크립트
 * Discogs API를 사용하여 인기 LP 20개를 가져와 Supabase에 저장
 * 
 * 실행 방법:
 * 1. 환경변수 설정: DISCOGS_USER_AGENT (선택사항, rate limit 완화)
 * 2. npm run fetch-lp-data 또는 tsx scripts/fetch-real-lp-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

// .env 파일 로드 시도
try {
  const envPath = resolve(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch (error) {
  // .env 파일이 없어도 계속 진행
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const discogsUserAgent = process.env.DISCOGS_USER_AGENT || 'itsmyturn/1.0';
const discogsToken = process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN;
const discogsConsumerKey = process.env.DISCOGS_CONSUMER_KEY;
const discogsConsumerSecret = process.env.DISCOGS_CONSUMER_SECRET;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다!');
  console.error('\n필요한 환경변수:');
  console.error('  - VITE_SUPABASE_URL 또는 SUPABASE_URL');
  console.error('  - VITE_SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n.env 파일을 생성하거나 환경변수를 설정해주세요.');
  console.error('\n예시 .env 파일:');
  console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('  DISCOGS_TOKEN=your-discogs-token (선택사항, API 인증용)');
  process.exit(1);
}

if (!discogsToken && (!discogsConsumerKey || !discogsConsumerSecret)) {
  console.error('❌ Discogs API 인증 정보가 필요합니다!');
  console.error('\n다음 중 하나를 설정해주세요:');
  console.error('  1. DISCOGS_TOKEN (Personal Access Token)');
  console.error('  2. DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET (OAuth 1.0a)');
  console.error('\nDiscogs에서 발급받으려면: https://www.discogs.com/settings/developers');
  process.exit(1);
}

if (discogsConsumerKey && discogsConsumerSecret) {
  console.log('✅ OAuth 1.0a 인증 사용 (Consumer Key/Secret)');
} else if (discogsToken) {
  console.log('✅ Personal Access Token 사용');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DiscogsRelease {
  id: number;
  title: string;
  artists?: Array<{ name: string }>;
  year?: number;
  thumb?: string;
  cover_image?: string;
  formats?: Array<{ name: string; qty: string }>;
  country?: string;
  barcode?: string[];
  genres?: string[];
  styles?: string[];
  tracklist?: Array<{ position: string; title: string; duration: string }>;
  notes?: string;
  labels?: Array<{ name: string; catno: string }>;
  released?: string;
}

interface DiscogsSearchResult {
  results: Array<{
    id: number;
    title: string;
    thumb: string;
    cover_image: string;
    year?: number;
    country?: string;
    format?: string[];
    barcode?: string[];
    master_id?: number;
  }>;
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
}

/**
 * OAuth 1.0a 인증 객체 생성
 */
function createOAuth() {
  return new OAuth({
    consumer: {
      key: discogsConsumerKey || '',
      secret: discogsConsumerSecret || '',
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

/**
 * Discogs API 헤더 생성
 */
function getDiscogsHeaders(url: string, method: string = 'GET'): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent': discogsUserAgent,
    'Accept': 'application/json',
  };

  // Personal Access Token 사용
  if (discogsToken) {
    headers['Authorization'] = `Discogs token=${discogsToken}`;
  }
  // Consumer Key/Secret이 있으면 OAuth 1.0a 사용
  else if (discogsConsumerKey && discogsConsumerSecret) {
    try {
      const oauth = createOAuth();
      const urlObj = new URL(url);

      // 쿼리 파라미터를 객체로 변환 (OAuth 서명에 포함)
      const data: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        data[key] = value;
      });

      // base URL (쿼리 파라미터 제외)
      const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

      const requestData = {
        url: baseUrl,
        method: method,
      };

      const token = {}; // OAuth 1.0a 2-legged (no user token)

      // OAuth 서명 생성 (쿼리 파라미터 포함)
      const authData = oauth.authorize(requestData, token, { data });
      const authHeader = oauth.toHeader(authData);

      headers['Authorization'] = authHeader.Authorization;

      // 디버깅: Authorization 헤더 확인 (처음 몇 글자만)
      if (authHeader.Authorization) {
        console.log('🔐 OAuth 헤더 생성 완료:', authHeader.Authorization.substring(0, 50) + '...');
      }
    } catch (error) {
      console.error('❌ OAuth 헤더 생성 실패:', error);
      throw error;
    }
  }

  return headers;
}

/**
 * Discogs API에서 인기 LP 검색
 * 매번 다른 앨범을 가져오기 위해 다양한 검색 전략 사용
 */
async function searchPopularLPs(page: number = 1, perPage: number = 20): Promise<DiscogsSearchResult> {
  // 다양한 검색 전략을 랜덤하게 선택
  const strategies = [
    // 전략 1: 최신 앨범 (최근 5년)
    () => {
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 5;
      return `type=release&format=LP&year=${startYear},${currentYear}&per_page=${perPage}&page=${page}&sort=year&sort_order=desc`;
    },
    // 전략 2: 인기 앨범 (want 수 기준, 랜덤 페이지)
    () => {
      const randomPage = Math.floor(Math.random() * 10) + 1; // 1-10 페이지 중 랜덤
      return `type=release&format=LP&per_page=${perPage}&page=${randomPage}&sort=want&sort_order=desc`;
    },
    // 전략 3: 다양한 장르별 검색
    () => {
      const genres = ['Rock', 'Jazz', 'Pop', 'Classical', 'Electronic', 'Hip Hop', 'Folk', 'Blues'];
      const randomGenre = genres[Math.floor(Math.random() * genres.length)];
      return `type=release&format=LP&genre=${encodeURIComponent(randomGenre)}&per_page=${perPage}&page=${page}&sort=want&sort_order=desc`;
    },
    // 전략 4: 특정 연도 범위 (랜덤)
    () => {
      const startYear = 1960 + Math.floor(Math.random() * 60); // 1960-2020
      const endYear = startYear + Math.floor(Math.random() * 10) + 1;
      return `type=release&format=LP&year=${startYear},${endYear}&per_page=${perPage}&page=${page}&sort=want&sort_order=desc`;
    },
    // 전략 5: 최신 앨범 (최근 3년, 랜덤 페이지)
    () => {
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 3;
      const randomPage = Math.floor(Math.random() * 5) + 1; // 1-5 페이지
      return `type=release&format=LP&year=${startYear},${currentYear}&per_page=${perPage}&page=${randomPage}&sort=year&sort_order=desc`;
    },
  ];

  // 랜덤 전략 선택
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const queryString = strategy();
  const url = `https://api.discogs.com/database/search?${queryString}`;

  const headers = getDiscogsHeaders(url, 'GET');

  // 디버깅: 요청 정보 출력
  console.log('📡 요청 URL:', url);
  console.log('📡 Authorization 헤더:', headers['Authorization'] ? headers['Authorization'].substring(0, 80) + '...' : '없음');

  const response = await fetch(url, {
    headers: headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ 응답 상태:', response.status);
    console.error('❌ 응답 본문:', errorText);

    // 401 에러인 경우 인증 없이 재시도 (일부 엔드포인트는 인증 불필요)
    if (response.status === 401 && (discogsConsumerKey || discogsToken)) {
      console.log('⚠️  인증 실패, 인증 없이 재시도...');
      const retryResponse = await fetch(url, {
        headers: {
          'User-Agent': discogsUserAgent,
          'Accept': 'application/json',
        },
      });

      if (retryResponse.ok) {
        console.log('✅ 인증 없이 성공!');
        return await retryResponse.json();
      }
    }

    throw new Error(`Discogs API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();

  // 결과가 없으면 기본 검색으로 폴백
  if (!data.results || data.results.length === 0) {
    console.log('검색 결과가 없습니다. 기본 검색으로 재시도...');
    const fallbackUrl = `https://api.discogs.com/database/search?type=release&format=LP&per_page=${perPage}&page=${page}&sort=want&sort_order=desc`;
    const fallbackResponse = await fetch(fallbackUrl, {
      headers: getDiscogsHeaders(fallbackUrl, 'GET'),
    });

    if (!fallbackResponse.ok) {
      throw new Error(`Discogs API fallback error: ${fallbackResponse.status}`);
    }

    return await fallbackResponse.json();
  }

  return data;
}

/**
 * Discogs API에서 특정 릴리즈 상세 정보 가져오기
 */
async function getReleaseDetails(releaseId: number): Promise<DiscogsRelease | null> {
  const url = `https://api.discogs.com/releases/${releaseId}`;

  try {
    const response = await fetch(url, {
      headers: getDiscogsHeaders(url, 'GET'),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch release ${releaseId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching release ${releaseId}:`, error);
    return null;
  }
}

/**
 * Discogs 데이터를 LpProduct 형식으로 변환
 */
function convertToLpProduct(release: DiscogsRelease, index: number): any {
  const artist = release.artists?.[0]?.name || 'Unknown Artist';
  const title = release.title || 'Unknown Title';
  const discogsId = release.id.toString();
  const barcode = release.barcode?.[0] || '';
  const cover = release.cover_image || release.thumb || '/images/DJ_duic.jpg';

  // 카테고리 추정
  const genres = release.genres || [];
  const styles = release.styles || [];
  let category = 'LP';
  let subCategory = 'general';

  if (genres.some(g => g.toLowerCase().includes('jazz'))) {
    subCategory = 'classic-jazz';
  } else if (genres.some(g => g.toLowerCase().includes('rock'))) {
    subCategory = 'rock';
  } else if (genres.some(g => g.toLowerCase().includes('pop'))) {
    subCategory = 'pop';
  } else if (genres.some(g => g.toLowerCase().includes('classical'))) {
    subCategory = 'classical';
  }

  // 포맷 정보에서 컬러/에디션 추출
  const formats = release.formats || [];
  const color = formats.some(f => f.name?.toLowerCase().includes('colored')) ? 'Colored' : 'Black';
  const edition = formats.some(f => f.name?.toLowerCase().includes('remaster')) ? 'Remastered' : 'Original';

  // 요약 생성
  const summary = release.notes
    ? release.notes.substring(0, 200)
    : `${artist}의 ${title}${release.year ? ` (${release.year})` : ''}`;

  const label = release.labels?.[0]?.name || null;
  const releaseDate = release.released || (release.year ? release.year.toString() : null);
  const trackList = release.tracklist?.map(t => ({
    position: t.position || '',
    title: t.title || '',
    duration: t.duration || ''
  })) || [];

  const format = formats.map(f => f.name).join(', ') || 'LP';

  return {
    // id: undefined, // Removed to let Supabase generate UUID via DEFAULT
    title: title,
    artist: artist,
    release_date: releaseDate,
    label: label,
    cover: cover,
    thumbnail_url: release.thumb || null,
    format: format,
    genres: genres,
    styles: styles,
    track_list: trackList,
    discogs_id: discogsId,
    // Map to new schema columns
    ean: barcode || null,
    description: summary,

    // Legacy fields removed to prevent PGRST204 errors
    // barcode: barcode, 
    // summary: summary, 

    last_synced_at: new Date().toISOString(),
  };
}

/**
 * 20개의 실제 LP 데이터를 가져와 Supabase에 저장
 * 기존 데이터는 유지하고 새로운 앨범만 추가합니다.
 */
async function fetchAndStoreRealLpData() {
  try {
    console.log('🔍 Discogs에서 인기 LP 검색 중...');

    // 기존 제품 ID 목록 가져오기 (중복 방지)
    const { data: existingProducts } = await supabase
      .from('lp_products')
      .select('discogs_id');

    const existingDiscogsIds = new Set(
      (existingProducts || [])
        .map(p => p.discogs_id)
        .filter(id => id && id.trim() !== '')
    );

    console.log(`📊 기존 앨범 ${existingDiscogsIds.size}개 발견 (중복 방지)`);

    const MAX_PAGES = 10;
    let totalAdded = 0;

    // 페이지네이션 루프 (1~10페이지)
    for (let page = 1; page <= MAX_PAGES; page++) {
      console.log(`\n📄 검색 페이지 ${page}/${MAX_PAGES}...`);

      try {
        // 검색 실행 (Vinyl 포맷, 페이지당 50개)
        const searchResult = await searchPopularLPs(page, 50);

        if (!searchResult.results || searchResult.results.length === 0) {
          console.log('⚠️ 더 이상 검색 결과가 없습니다.');
          break;
        }

        console.log(`📦 발견된 항목: ${searchResult.results.length}개`);

        const productsToAdd = [];

        for (const result of searchResult.results) {
          // 중복 체크
          if (existingDiscogsIds.has(String(result.id))) {
            continue;
          }

          // 포맷 필터링: CD 제외, Vinyl 필수
          const formats = (result.format || []).map(f => f.toLowerCase());
          const isVinyl = formats.some(f => f.includes('vinyl') || f.includes('lp') || f.includes('12"'));
          const isCD = formats.some(f => f.includes('cd') || f.includes('compact disc'));

          if (!isVinyl || isCD) {
            continue;
          }

          try {
            // 변환 (검색 결과 -> LpProduct)
            // 상세 API 호출 없이 검색 결과만으로 1차 저장 (Rate Limit 회피)
            const product = {
              title: result.title,
              artist: 'Unknown Artist',
              release_date: result.year ? String(result.year) : null,
              cover: result.cover_image || result.thumb || '/images/DJ_duic.jpg',
              thumbnail_url: result.thumb || null,
              format: (result.format || []).join(', ') || 'Vinyl',
              genres: [],
              styles: [],
              discogs_id: String(result.id),
              ean: result.barcode?.[0] || null,
              description: `${result.title} (${result.year || 'Unknown'}) - ${result.country || 'Unknown'}`,
              last_synced_at: new Date().toISOString(),
            };

            // 제목에서 아티스트 분리
            if (result.title.includes(' - ')) {
              const parts = result.title.split(' - ');
              product.artist = parts[0].trim();
              product.title = parts.slice(1).join(' - ').trim();
            } else {
              product.artist = result.title; // Fallback
            }

            productsToAdd.push(product);
            existingDiscogsIds.add(String(result.id)); // 중복 방지 업데이트

          } catch (err) {
            console.error(`❌ 처리 오류 (${result.id}):`, err);
          }
        }

        if (productsToAdd.length > 0) {
          console.log(`💾 ${productsToAdd.length}개 신규 앨범 저장 중...`);

          const { error } = await supabase
            .from('lp_products')
            .upsert(productsToAdd, { onConflict: 'discogs_id' });

          if (error) {
            console.error('❌ Supabase 저장 실패:', error);
          } else {
            console.log('✅ 저장 성공!');
            totalAdded += productsToAdd.length;
          }
        } else {
          process.stdout.write('.'); // 진행 상황 표시
        }

        // Rate Limit 보호
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (err) {
        console.error(`❌ 페이지 ${page} 오류:`, err);
      }
    }

    console.log(`\n🎉 전체 완료! 총 ${totalAdded}개의 LP가 추가되었습니다.`);

  } catch (error) {
    console.error('치명적인 오류 발생:', error);
    throw error;
  }
}

// 스크립트 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fetch-real-lp-data.ts')) {
  fetchAndStoreRealLpData()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { fetchAndStoreRealLpData };

