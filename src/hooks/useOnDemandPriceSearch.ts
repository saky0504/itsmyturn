import { useState, useCallback, useRef } from 'react';

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
    vendor?: string;
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const searchPrices = useCallback(async (params: {
    productId?: string;
    artist?: string;
    title?: string;
    ean?: string;
    discogsId?: string;
    forceRefresh?: boolean;
    vendor?: string;
  }): Promise<PriceSearchResult | null> => {
    // 진행 중인 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: params.productId,
          artist: params.artist,
          title: params.title,
          ean: params.ean,
          discogsId: params.discogsId,
          forceRefresh: params.forceRefresh || false,
          vendor: params.vendor,
        }),
        signal: controller.signal,
      });

      // 이 요청이 최신 요청인지 확인
      if (requestId !== requestIdRef.current) return null;

      if (!response.ok) {
        let errorData: any;
        try {
          const text = await response.text();
          try { errorData = JSON.parse(text); }
          catch { errorData = { error: text || `HTTP ${response.status}` }; }
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data) throw new Error('검색 결과가 없습니다.');
      return data as PriceSearchResult;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(new Error(errorMessage));
      console.error('[온디맨드 가격 검색] 오류:', { message: errorMessage, params });
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  return { searchPrices, isLoading, error };
};
