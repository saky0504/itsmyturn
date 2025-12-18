/**
 * LP 제품 데이터 확인 스크립트
 * localStorage에 저장된 제품 데이터와 가격 정보를 확인합니다.
 */

const STORAGE_KEY = 'itsmyturn:lp-market-products';

function checkProducts() {
  if (typeof window === 'undefined') {
    console.log('❌ 브라우저 환경에서만 실행 가능합니다.');
    console.log('브라우저 콘솔에서 다음 명령어를 실행하세요:');
    console.log(`
      const products = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '[]');
      console.log('총 제품 수:', products.length);
      products.forEach((p, i) => {
        console.log(\`제품 \${i+1}: \${p.title} - \${p.artist}\`);
        console.log('  - offers 수:', p.offers?.length || 0);
        if (p.offers && p.offers.length > 0) {
          p.offers.forEach((o, j) => {
            console.log(\`    \${j+1}. \${o.vendorName}: \${o.basePrice.toLocaleString()}원\`);
          });
        } else {
          console.log('    ⚠️ 가격 정보 없음');
        }
      });
    `);
    return;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    console.log('❌ localStorage에 제품 데이터가 없습니다.');
    console.log('Admin 페이지에서 제품을 추가하거나, 크롤링 스크립트를 실행해주세요.');
    return;
  }

  try {
    const products = JSON.parse(raw) as any[];
    console.log(`✅ 총 ${products.length}개의 제품이 있습니다.`);
    
    if (products.length === 0) {
      console.log('⚠️ 제품이 하나도 없습니다. Admin 페이지에서 제품을 추가해주세요.');
      return;
    }

    let productsWithOffers = 0;
    let totalOffers = 0;

    products.forEach((product, index) => {
      const offerCount = product.offers?.length || 0;
      if (offerCount > 0) {
        productsWithOffers++;
        totalOffers += offerCount;
      }

      console.log(`\n제품 ${index + 1}: ${product.title || '제목 없음'} - ${product.artist || '아티스트 없음'}`);
      console.log(`  - ID: ${product.id}`);
      console.log(`  - EAN: ${product.barcode || '없음'}`);
      console.log(`  - Discogs ID: ${product.discogsId || '없음'}`);
      console.log(`  - Offers: ${offerCount}개`);
      
      if (offerCount > 0) {
        product.offers.forEach((offer: any, offerIndex: number) => {
          console.log(`    ${offerIndex + 1}. ${offer.vendorName} - ${offer.basePrice?.toLocaleString() || 0}원 (${offer.channelId})`);
        });
      } else {
        console.log('    ⚠️ 가격 정보 없음');
      }
    });

    console.log(`\n📊 통계:`);
    console.log(`  - 총 제품 수: ${products.length}`);
    console.log(`  - 가격 정보가 있는 제품: ${productsWithOffers}개`);
    console.log(`  - 가격 정보가 없는 제품: ${products.length - productsWithOffers}개`);
    console.log(`  - 총 offers 수: ${totalOffers}개`);

    if (productsWithOffers === 0) {
      console.log('\n⚠️ 가격 정보가 있는 제품이 하나도 없습니다.');
      console.log('다음 중 하나를 실행하세요:');
      console.log('  1. npm run test-price-crawling - 가격 크롤링 테스트');
      console.log('  2. Admin 페이지에서 수동으로 가격 정보 추가');
      console.log('  3. 제품 상세 페이지에서 "가격 정보 새로고침" 버튼 클릭');
    }
  } catch (error) {
    console.error('❌ 데이터 파싱 오류:', error);
  }
}

// 브라우저 환경에서만 실행
if (typeof window !== 'undefined') {
  checkProducts();
} else {
  console.log('브라우저 콘솔에서 다음 코드를 실행하세요:');
  console.log(`
    const products = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '[]');
    console.log('총 제품 수:', products.length);
    const withOffers = products.filter(p => p.offers && p.offers.length > 0);
    console.log('가격 정보가 있는 제품:', withOffers.length);
    products.forEach((p, i) => {
      console.log(\`\${i+1}. \${p.title} - offers: \${p.offers?.length || 0}개\`);
    });
  `);
}

export { checkProducts };

