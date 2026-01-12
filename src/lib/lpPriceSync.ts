/**
 * LP 가격 정보 동기화 유틸리티
 * 크롤링한 가격 정보를 UI에 적용하기 위한 함수들
 */

import type { LpOffer, LpProduct } from '../data/lpMarket';

/**
 * VendorOffer를 LpOffer로 변환
 * (sync-lp-data.ts의 VendorOffer 인터페이스와 호환)
 */
export interface VendorOffer {
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

/**
 * VendorOffer를 LpOffer로 변환
 */
export function convertVendorOfferToLpOffer(vendorOffer: VendorOffer): LpOffer {
  return {
    id: `offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    vendorName: vendorOffer.vendorName,
    channelId: vendorOffer.channelId,
    basePrice: vendorOffer.basePrice,
    currency: 'KRW',
    shippingFee: vendorOffer.shippingFee,
    shippingPolicy: vendorOffer.shippingPolicy,
    url: vendorOffer.url,
    affiliateCode: vendorOffer.affiliateCode,
    affiliateParamKey: vendorOffer.affiliateParamKey,
    inStock: vendorOffer.inStock,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * 제품의 가격 정보 업데이트
 * 기존 offers와 새 offers를 병합 (같은 vendorName이면 업데이트, 없으면 추가)
 */
export function updateProductOffers(
  product: LpProduct,
  newOffers: VendorOffer[]
): LpProduct {
  const convertedOffers = newOffers.map(convertVendorOfferToLpOffer);

  // 기존 offers를 맵으로 변환 (vendorName + channelId를 키로 사용)
  const existingOffersMap = new Map<string, LpOffer>();
  product.offers.forEach((offer) => {
    const key = `${offer.vendorName}-${offer.channelId}`;
    existingOffersMap.set(key, offer);
  });

  // 새 offers로 업데이트 또는 추가
  convertedOffers.forEach((newOffer) => {
    const key = `${newOffer.vendorName}-${newOffer.channelId}`;
    const existingOffer = existingOffersMap.get(key);

    if (existingOffer) {
      // 기존 offer 업데이트 (ID는 유지)
      existingOffersMap.set(key, {
        ...newOffer,
        id: existingOffer.id,
      });
    } else {
      // 새 offer 추가
      existingOffersMap.set(key, newOffer);
    }
  });

  return {
    ...product,
    offers: Array.from(existingOffersMap.values()),
  };
}

/**
 * Supabase Edge Function을 통해 가격 정보 가져오기
 */

export async function fetchPricesFromEdgeFunction(
  productId: string,
  identifier: Record<string, unknown>
): Promise<VendorOffer[]> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL이 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL을 설정해주세요.');
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/sync-lp-prices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          identifier,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Edge Function이 아직 배포되지 않았습니다. Supabase에서 Edge Function을 배포해주세요.');
      }
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return data.offers || [];
  } catch (error) {
    console.error('가격 정보 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 클라이언트에서 직접 크롤링 (CORS 문제로 제한적)
 * 주의: 대부분의 쇼핑몰은 CORS를 차단하므로 Edge Function 사용 권장
 */
export async function fetchPricesDirectly(): Promise<VendorOffer[]> {
  // 클라이언트에서 직접 크롤링은 CORS 문제로 어려움
  // 대신 Edge Function을 통해 가져오는 것을 권장
  console.warn('클라이언트에서 직접 크롤링은 CORS 문제로 제한적입니다. Edge Function 사용을 권장합니다.');

  // 임시로 빈 배열 반환 (실제 구현 시 Edge Function 사용)
  return [];
}

