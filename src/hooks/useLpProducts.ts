import { useCallback, useEffect, useState } from 'react';
import type { LpProduct } from '../data/lpMarket';
import { getDefaultProducts, loadProducts, saveProducts } from '../lib/lpMarketStore';

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
    setProducts(loadProducts());
    setIsReady(true);
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




