/**
 * 한 시간마다 실행되는 통합 동기화 스크립트
 * 
 * 1. Discogs에서 추가로 20개의 앨범을 가져온다
 * 2. 전체 앨범 정보에 가격 정보를 확인하여 UI에 반영한다
 * 3. 존재하는 가격정보를 적용한다
 * 
 * 실행 방법:
 * - Vercel Cron: vercel.json에 cron 설정
 * - GitHub Actions: .github/workflows/hourly-sync.yml
 * - Supabase Edge Function: supabase/functions/hourly-sync
 * - 수동 실행: npm run hourly-sync
 */

import { fetchAndStoreRealLpData } from './fetch-real-lp-data';
import { syncAllProducts } from './sync-lp-data';
import { cleanupBadProducts, cleanupBadOffers, cleanupDuplicateOffers, cleanupInvalidUrls } from './cleanup';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// 일일 호출 제한 추적을 위한 Supabase 클라이언트
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 일일 호출 제한 설정
const DAILY_API_LIMITS = {
  naver: 500,
  aladin: 300,
  discogs: 1000,
};

// Rate limit 에러 감지 함수
function isRateLimitError(error: any): boolean {
  const errorMessage = error?.message || String(error) || '';
  const errorStatus = error?.status || error?.response?.status;
  
  return (
    errorStatus === 429 || // Too Many Requests
    errorStatus === 403 || // Forbidden (일부 API는 rate limit 시 403 반환)
    errorMessage.includes('rate limit') ||
    errorMessage.includes('Rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429')
  );
}

// Helper wrapper for dynamic import (since it's a standalone script)
async function runKoreanDiscovery() {
  const { discoverKoreanLPs } = await import('./discover-korean-lps');
  await discoverKoreanLPs();
}

/**
 * 통합 동기화 작업 (안전 모드)
 */
async function hourlySync() {
  const startTime = Date.now();
  console.log('🔄 한 시간마다 실행되는 동기화 작업 시작 (안전 모드)...\n');

  try {
    // 0. 한국 가요/LP 신규 데이터 발굴 (Aladin)
    console.log('🇰🇷 [0/4] 국내 가요/LP 데이터 발굴 (Aladin)...');
    try {
      await runKoreanDiscovery();
      console.log('✅ 국내 LP 발굴 완료\n');
    } catch (error) {
      console.error('❌ 국내 LP 발굴 실패:', error);
      
      // Rate limit 에러 감지 시 즉시 중단
      if (isRateLimitError(error)) {
        console.error('🚨 Rate limit 에러 감지! 1시간 대기 후 종료합니다.');
        console.error('다음 실행까지 대기하세요.');
        throw new Error('Rate limit exceeded. Please wait 1 hour before retrying.');
      }
      
      // 다른 에러는 계속 진행 (치명적이지 않은 경우)
      console.error('⚠️ 계속 진행합니다...\n');
    }

    // 1. Discogs에서 추가 앨범 데이터 수집 (페이지네이션 적용됨)
    console.log('📦 [1/4] Discogs에서 추가 앨범 데이터 수집...');
    try {
      await fetchAndStoreRealLpData();
      console.log('✅ Discogs 앨범 가져오기 완료\n');
    } catch (error) {
      console.error('❌ Discogs 앨범 가져오기 실패:', error);
      
      // Rate limit 에러 감지 시 즉시 중단
      if (isRateLimitError(error)) {
        console.error('🚨 Rate limit 에러 감지! 1시간 대기 후 종료합니다.');
        throw new Error('Rate limit exceeded. Please wait 1 hour before retrying.');
      }
      
      // 다른 에러는 계속 진행
      console.error('⚠️ 계속 진행합니다...\n');
    }

    // 2. 전체 앨범 정보에 가격 정보 확인 및 동기화
    console.log('💰 [2/4] 전체 앨범 가격 정보 동기화 (점진적: 하루 50개씩)...');
    try {
      await syncAllProducts();
      console.log('✅ 가격 정보 동기화 완료\n');
    } catch (error) {
      console.error('❌ 가격 정보 동기화 실패:', error);
      
      // Rate limit 에러 감지 시 즉시 중단
      if (isRateLimitError(error)) {
        console.error('🚨 Rate limit 에러 감지! 1시간 대기 후 종료합니다.');
        throw new Error('Rate limit exceeded. Please wait 1 hour before retrying.');
      }
      
      // API 에러 발생 시 즉시 중단 (안전 모드)
      throw error;
    }

    // 3. 존재하는 가격정보 적용 (syncAllProducts에서 이미 처리됨)
    console.log('✅ [3/4] 가격정보 적용 완료 (동기화 과정에서 처리됨)\n');

    // 4. 데이터 정제 (잘못된 상품 및 가격 제거)
    console.log('🧹 [4/4] 데이터 정제 작업...');
    try {
      await cleanupBadProducts();
      await cleanupBadOffers();
      await cleanupDuplicateOffers();
      await cleanupInvalidUrls(); // 잘못된 URL 제거 추가
      console.log('✅ 데이터 정제 완료\n');
    } catch (error) {
      console.error('❌ 데이터 정제 실패 (치명적이지 않음):', error);
      // 데이터 정제 실패는 치명적이지 않으므로 계속 진행
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 전체 동기화 작업 완료! (소요 시간: ${duration}초)`);

    return {
      success: true,
      duration: parseFloat(duration),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ 동기화 작업 실패 (소요 시간: ${duration}초):`, error);
    
    // Rate limit 에러인 경우 특별 처리
    if (isRateLimitError(error)) {
      console.error('\n🚨 Rate Limit 위반 감지!');
      console.error('다음 실행까지 최소 1시간 대기하세요.');
      console.error('일일 호출 제한:');
      console.error(`  - 네이버: ${DAILY_API_LIMITS.naver}회/일`);
      console.error(`  - 알라딘: ${DAILY_API_LIMITS.aladin}회/일`);
      console.error(`  - Discogs: ${DAILY_API_LIMITS.discogs}회/일`);
    }

    return {
      success: false,
      duration: parseFloat(duration),
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      rateLimitExceeded: isRateLimitError(error),
    };
  }
}

// 스크립트 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('hourly-sync.ts')) {
  hourlySync()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ 스크립트 실행 완료');
        process.exit(0);
      } else {
        console.error('\n❌ 스크립트 실행 실패');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 중 오류:', error);
      process.exit(1);
    });
}

export { hourlySync };

