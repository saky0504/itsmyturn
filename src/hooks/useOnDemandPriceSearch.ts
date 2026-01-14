import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PriceOffer {
  vendorName: string;
  channelId: string;
  basePrice: number;
  shippingFee: number;
  shippingPolicy: string;
  url: string;
  inStock: boolean;
  affiliateCode?: string;
  affiliateParamKey?: string;
}

export interface PriceSearchResult {
  offers: PriceOffer[];
  cached: boolean;
  searchTime: number;
  productId: string | null;
}

export interface UseOnDemandPriceSearchResult {
  searchPrices: (params: {
    productId?: string;
    artist?: string;
    title?: string;
    ean?: string;
    discogsId?: string;
    forceRefresh?: boolean;
  }) => Promise<PriceSearchResult | null>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * 온디맨드 가격 검색 훅
 * Edge Function을 호출하여 실시간 가격 검색 또는 캐시된 데이터 반환
 */
export const useOnDemandPriceSearch = (): UseOnDemandPriceSearchResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const searchPrices = useCallback(async (params: {
    productId?: string;
    artist?: string;
    title?: string;
    ean?: string;
    discogsId?: string;
    forceRefresh?: boolean;
  }): Promise<PriceSearchResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Vercel Serverless Function 호출
      const response = await fetch('/api/search-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: params.productId,
          artist: params.artist,
          title: params.title,
          ean: params.ean,
          discogsId: params.discogsId,
          forceRefresh: params.forceRefresh || false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const functionError = null; // Vercel Function은 error 객체를 반환하지 않음

      if (!data) {
        throw new Error('검색 결과가 없습니다.');
      }

      return data as PriceSearchResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(new Error(errorMessage));
      console.error('[온디맨드 가격 검색] 오류:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    searchPrices,
    isLoading,
    error,
  };
};
