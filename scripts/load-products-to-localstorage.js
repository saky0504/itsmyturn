/**
 * 제품 데이터를 localStorage에 로드하는 스크립트
 * JSON 파일을 자동으로 읽어서 localStorage에 저장합니다.
 */

const STORAGE_KEY = 'itsmyturn:lp-market-products';
const JSON_URL = '/data/lp-products.json';

// 브라우저 환경에서 실행
if (typeof window !== 'undefined') {
  async function loadProductsFromJSON() {
    try {
      console.log('📡 JSON 파일에서 제품 데이터 로드 중...');
      
      // JSON 파일 fetch
      const response = await fetch(JSON_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const products = await response.json();
      console.log(`✅ ${products.length}개 제품 데이터 로드 완료`);
      
      // 기존 제품 데이터 로드
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const existingIds = new Set(existing.map(p => p.id));
      
      // 새 제품 추가 (중복 제거)
      const allProducts = [...existing];
      let addedCount = 0;
      let updatedCount = 0;
      
      products.forEach(product => {
        if (!existingIds.has(product.id)) {
          allProducts.push(product);
          addedCount++;
          console.log(`✅ 제품 추가: ${product.title} - ${product.artist} (가격: ${product.offers[0]?.basePrice?.toLocaleString() || 0}원)`);
        } else {
          // 기존 제품 업데이트 (offers 병합)
          const existingIndex = existing.findIndex(p => p.id === product.id);
          if (existingIndex !== -1) {
            const existingProduct = existing[existingIndex];
            // offers 병합 (같은 vendorName과 channelId가 있으면 업데이트, 없으면 추가)
            const existingOffers = existingProduct.offers || [];
            const newOffers = [...existingOffers];
            
            product.offers.forEach(newOffer => {
              const existingOfferIndex = newOffers.findIndex(
                o => o.vendorName === newOffer.vendorName && o.channelId === newOffer.channelId
              );
              if (existingOfferIndex !== -1) {
                newOffers[existingOfferIndex] = newOffer;
              } else {
                newOffers.push(newOffer);
              }
            });
            
            allProducts[existingIndex] = {
              ...existingProduct,
              ...product,
              offers: newOffers
            };
            updatedCount++;
            console.log(`🔄 제품 업데이트: ${product.title} - ${product.artist} (가격: ${product.offers[0]?.basePrice?.toLocaleString() || 0}원)`);
          }
        }
      });
      
      // localStorage에 저장
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allProducts));
      
      console.log(`\n✅ 완료!`);
      console.log(`  - 총 제품 수: ${allProducts.length}개`);
      console.log(`  - 새로 추가: ${addedCount}개`);
      console.log(`  - 업데이트: ${updatedCount}개`);
      console.log(`\n가격 정보가 있는 제품:`);
      allProducts.forEach((p, i) => {
        if (p.offers && p.offers.length > 0) {
          const bestOffer = p.offers[0];
          console.log(`  ${i+1}. ${p.title} - ${p.artist}: ${bestOffer.basePrice.toLocaleString()}원 (${bestOffer.vendorName})`);
        }
      });
      
      // 페이지 새로고침 안내
      console.log(`\n💡 페이지를 새로고침하면 변경사항이 반영됩니다.`);
      
      return { success: true, total: allProducts.length, added: addedCount, updated: updatedCount };
    } catch (error) {
      console.error('❌ 오류 발생:', error);
      console.error('JSON 파일 경로를 확인하세요:', JSON_URL);
      return { success: false, error: error.message };
    }
  }
  
  // 자동 실행
  loadProductsFromJSON();
} else {
  console.log('브라우저 환경에서만 실행 가능합니다.');
  console.log('브라우저 콘솔에서 이 스크립트를 실행하거나, HTML 파일로 만들어서 실행하세요.');
}
