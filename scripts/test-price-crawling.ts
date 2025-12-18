/**
 * 가격 크롤링 테스트 스크립트
 * 특정 제품에 대해 가격 정보를 수집하는지 테스트합니다.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env 파일 로드 시도 (import 전에 실행되어야 함)
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

// 환경변수 확인
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다!');
  console.error('\n필요한 환경변수:');
  console.error('  - SUPABASE_URL 또는 VITE_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY 또는 VITE_SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n.env 파일을 생성하거나 환경변수를 설정해주세요.');
  process.exit(1);
}

// collectPricesForProduct import (환경변수 설정 후)
import { collectPricesForProduct } from './sync-lp-data';

// 테스트용 제품 식별자 (실제 데이터로 변경 가능)
const testProducts = [
  {
    ean: '8808678300017', // 예시 EAN (실제 LP 바코드로 변경)
    title: 'Paranoid',
    artist: 'Black Sabbath',
    discogsId: '12345', // 예시 Discogs ID
  },
  {
    title: 'In Rainbows',
    artist: 'Radiohead',
    discogsId: '67890',
  },
  // 실제 한국에서 판매되는 LP로 테스트
  {
    title: 'Abbey Road',
    artist: 'The Beatles',
  },
  {
    title: 'Kind of Blue',
    artist: 'Miles Davis',
  },
];

async function testPriceCrawling() {
  console.log('🧪 가격 크롤링 테스트 시작...\n');
  
  // 네이버 API 키 확인
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
  
  console.log('📋 환경 설정 확인:');
  console.log(`   - 네이버 Client ID: ${naverClientId ? naverClientId.substring(0, 8) + '...' : '❌ 없음'}`);
  console.log(`   - 네이버 Client Secret: ${naverClientSecret ? '✅ 설정됨' : '❌ 없음'}`);
  console.log('');

  for (const product of testProducts) {
    console.log(`\n📦 테스트 제품: ${product.artist || '아티스트 없음'} - ${product.title || '제목 없음'}`);
    console.log(`   EAN: ${product.ean || '없음'}`);
    console.log(`   Discogs ID: ${product.discogsId || '없음'}`);
    console.log('   ---');

    try {
      const offers = await collectPricesForProduct(product);
      
      if (offers.length > 0) {
        console.log(`\n✅ ${offers.length}개의 가격 정보를 찾았습니다:`);
        offers.forEach((offer, index) => {
          console.log(`   ${index + 1}. ${offer.vendorName} - ${offer.basePrice.toLocaleString()}원`);
          console.log(`      채널: ${offer.channelId}`);
          console.log(`      배송비: ${offer.shippingFee.toLocaleString()}원`);
          console.log(`      재고: ${offer.inStock ? '있음' : '없음'}`);
          console.log(`      URL: ${offer.url}`);
        });
      } else {
        console.log('\n⚠️  가격 정보를 찾을 수 없습니다.');
        console.log('   가능한 이유:');
        console.log('   1. 해당 제품이 쇼핑몰에 없음');
        console.log('   2. HTML 구조가 변경되어 크롤링 실패');
        console.log('   3. 검색어가 정확하지 않음');
        console.log('   4. JavaScript 렌더링이 필요한 사이트 (쿠팡 등)');
        console.log('   5. 네이버 API 키가 올바르지 않거나 권한이 없음');
        
        if (!naverClientId || !naverClientSecret) {
          console.log('\n   ⚠️  네이버 API 키가 설정되지 않았습니다!');
          console.log('   .env 파일에 다음을 추가하세요:');
          console.log('   NAVER_CLIENT_ID=your_client_id');
          console.log('   NAVER_CLIENT_SECRET=your_client_secret');
        }
      }
    } catch (error) {
      console.error(`\n❌ 오류 발생:`, error);
      if (error instanceof Error) {
        console.error(`   오류 메시지: ${error.message}`);
        if (error.stack) {
          console.error(`   스택 트레이스: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
      }
    }

    // 다음 테스트 전 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ 테스트 완료');
}

// 스크립트 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('test-price-crawling.ts')) {
  testPriceCrawling()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { testPriceCrawling };

