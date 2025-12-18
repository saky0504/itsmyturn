/**
 * 브라우저에서 실행할 제품 로드 스크립트
 * data/lp-products.json 파일의 내용을 localStorage에 추가합니다.
 */

// 파일을 읽어서 localStorage에 추가하는 함수
async function loadProductsToBrowser() {
  try {
    const response = await fetch('/data/lp-products.json');
    const products = await response.json();
    
    // 기존 제품 로드
    const existing = JSON.parse(localStorage.getItem('itsmyturn:lp-market-products') || '[]');
    
    // 중복 제거하면서 병합
    const allProducts = [...existing];
    products.forEach(newProduct => {
      const exists = allProducts.some(p => 
        p.id === newProduct.id || 
        (p.barcode === newProduct.barcode && p.barcode) ||
        (p.title === newProduct.title && p.artist === newProduct.artist)
      );
      if (!exists) {
        allProducts.push(newProduct);
      }
    });
    
    // localStorage에 저장
    localStorage.setItem('itsmyturn:lp-market-products', JSON.stringify(allProducts));
    
    console.log(`✅ ${products.length}개 제품 추가 완료! 총 ${allProducts.length}개 제품`);
    console.log('페이지를 새로고침하세요.');
    
    return allProducts;
  } catch (error) {
    console.error('제품 로드 실패:', error);
    throw error;
  }
}

// 자동 실행
loadProductsToBrowser().then(() => {
  location.reload();
});


