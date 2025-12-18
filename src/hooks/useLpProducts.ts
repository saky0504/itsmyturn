import { useCallback, useEffect, useState } from 'react';
import type { LpProduct } from '../data/lpMarket';
import { getDefaultProducts, loadProducts, loadProductsFromJSON, saveProducts } from '../lib/lpMarketStore';

interface UseLpProductsResult {
  products: LpProduct[];
  isReady: boolean;
  refresh: () => void;
  updateProducts: (updater: (items: LpProduct[]) => LpProduct[]) => void;
}

export const useLpProducts = (): UseLpProductsResult => {
  const [products, setProducts] = useState<LpProduct[]>(getDefaultProducts());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeProducts = async () => {
      // 먼저 localStorage에서 로드
      const localProducts = loadProducts();
      
      // localStorage에 데이터가 없거나 비어있으면 JSON 파일에서 로드 시도
      if (localProducts.length === 0) {
        try {
          const jsonProducts = await loadProductsFromJSON();
          setProducts(jsonProducts);
        } catch (error) {
          console.warn('JSON 로드 실패, 기본값 사용:', error);
          setProducts(localProducts);
        }
      } else {
        setProducts(localProducts);
      }
      
      setIsReady(true);
    };
    
    initializeProducts();
  }, []);

  const refresh = useCallback(() => {
    setProducts(loadProducts());
  }, []);

  const updateProducts = useCallback(
    (updater: (items: LpProduct[]) => LpProduct[]) => {
      setProducts((prev) => {
        const next = updater(prev);
        saveProducts(next);
        return next;
      });
    },
    []
  );

  return { products, isReady, refresh, updateProducts };
};





