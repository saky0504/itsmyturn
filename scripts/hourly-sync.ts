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
import { cleanupBadProducts, cleanupBadOffers } from './cleanup';

// Helper wrapper for dynamic import (since it's a standalone script)
async function runKoreanDiscovery() {
  const { discoverKoreanLPs } = await import('./discover-korean-lps');
  await discoverKoreanLPs();
}

/**
 * 통합 동기화 작업
 */
async function hourlySync() {
  const startTime = Date.now();
  console.log('🔄 한 시간마다 실행되는 동기화 작업 시작...\n');

  try {
    // 0. 한국 가요/LP 신규 데이터 발굴 (Aladin)
    console.log('🇰🇷 [0/4] 국내 가요/LP 데이터 발굴 (Aladin)...');
    try {
      await runKoreanDiscovery();
      console.log('✅ 국내 LP 발굴 완료\n');
    } catch (error) {
      console.error('❌ 국내 LP 발굴 실패 (계속 진행):', error);
    }

    // 1. Discogs에서 추가 앨범 데이터 수집 (페이지네이션 적용됨)
    console.log('📦 [1/4] Discogs에서 추가 앨범 데이터 수집...');
    try {
      await fetchAndStoreRealLpData();
      console.log('✅ Discogs 앨범 가져오기 완료\n');
    } catch (error) {
      console.error('❌ Discogs 앨범 가져오기 실패:', error);
      // 에러가 발생해도 가격 동기화는 계속 진행
    }

    // 2. 전체 앨범 정보에 가격 정보 확인 및 동기화
    console.log('💰 [2/3] 전체 앨범 가격 정보 동기화...');
    try {
      await syncAllProducts();
      console.log('✅ 가격 정보 동기화 완료\n');
    } catch (error) {
      console.error('❌ 가격 정보 동기화 실패:', error);
      throw error; // 가격 동기화 실패는 전체 작업 실패로 처리
    }

    // 3. 존재하는 가격정보 적용 (syncAllProducts에서 이미 처리됨)
    console.log('✅ [3/3] 가격정보 적용 완료 (동기화 과정에서 처리됨)\n');

    // 4. 데이터 정제 (잘못된 상품 및 가격 제거)
    console.log('🧹 [4/4] 데이터 정제 작업...');
    try {
      await cleanupBadProducts();
      await cleanupBadOffers();
      console.log('✅ 데이터 정제 완료\n');
    } catch (error) {
      console.error('❌ 데이터 정제 실패 (치명적이지 않음):', error);
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

    return {
      success: false,
      duration: parseFloat(duration),
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
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

