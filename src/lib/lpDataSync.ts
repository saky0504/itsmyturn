import { supabase } from './supabase';
import type { LpProduct, LpOffer } from '../data/lpMarket';

// Supabase 테이블 타입 정의
export interface SupabaseLpProduct {
  id: string;
  title: string;
  artist: string;
  cover: string;
  category: string;
  sub_category: string;
  discogs_id: string;
  barcode: string;
  summary: string;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface SupabaseLpOffer {
  id: string;
  product_id: string;
  vendor_name: string;
  channel_id: string;
  base_price: number;
  currency: string;
  shipping_fee: number;
  shipping_policy: string;
  url: string;
  affiliate_code: string | null;
  affiliate_param_key: string | null;
  in_stock: boolean;
  last_checked: string;
  badge: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Supabase에서 제품 목록 가져오기
export async function fetchProductsFromSupabase(): Promise<LpProduct[]> {
  try {
    const { data: products, error } = await supabase
      .from('lp_products')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching products from Supabase:', error);
      return [];
    }

    if (!products || products.length === 0) {
      return [];
    }

    // 각 제품의 offers 가져오기
    const productIds = products.map(p => p.id);
    const { data: offers, error: offersError } = await supabase
      .from('lp_offers')
      .select('*')
      .in('product_id', productIds);

    if (offersError) {
      console.error('Error fetching offers from Supabase:', offersError);
    }

    // 데이터 변환
    return products.map(product => {
      const productOffers = (offers || [])
        .filter(o => o.product_id === product.id)
        .map(offer => ({
          id: offer.id,
          vendorName: offer.vendor_name,
          channelId: offer.channel_id,
          basePrice: offer.base_price,
          currency: offer.currency as 'KRW',
          shippingFee: offer.shipping_fee,
          shippingPolicy: offer.shipping_policy,
          url: offer.url,
          affiliateCode: offer.affiliate_code || undefined,
          affiliateParamKey: offer.affiliate_param_key || undefined,
          inStock: offer.in_stock,
          lastChecked: offer.last_checked,
          badge: (offer.badge as 'fresh' | 'lowest' | 'exclusive') || undefined,
          notes: offer.notes || undefined,
        } as LpOffer));

      return {
        id: product.id,
        title: product.title,
        artist: product.artist,
        cover: product.cover,
        category: product.category,
        subCategory: product.sub_category,
        color: '',
        colorVariants: [],
        edition: '',
        editionVariants: [],
        country: '',
        discogsId: product.discogs_id,
        barcode: product.barcode,
        tags: [],
        rarityIndex: 0,
        lpr: 0,
        last30dChange: 0,
        priceHistory: [],
        offers: productOffers,
        summary: product.summary,
        pressingNotes: '',
        listeningNotes: [],
        preferredSetups: [],
        careTips: [],
        inventoryStatus: 'in-stock' as const,
        restockVendors: [],
        priceFloorEstimate: 0,
        priceCeilingEstimate: 0,
        recommendedPairing: {
          turntable: '',
          cartridge: '',
          phonoStage: '',
        },
      } as LpProduct;
    });
  } catch (error) {
    console.error('Error in fetchProductsFromSupabase:', error);
    return [];
  }
}

// 제품 동기화 (Supabase에서 가져와서 localStorage에 저장)
export async function syncProductsFromSupabase(): Promise<{
  success: boolean;
  count: number;
  lastSynced: string | null;
}> {
  try {
    const products = await fetchProductsFromSupabase();
    
    if (products.length === 0) {
      return {
        success: false,
        count: 0,
        lastSynced: null,
      };
    }

    // localStorage에 저장
    const STORAGE_KEY = 'itsmyturn:lp-market-products';
    const SYNC_KEY = 'itsmyturn:lp-market-sync';
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    const now = new Date().toISOString();
    localStorage.setItem(SYNC_KEY, JSON.stringify({
      lastSynced: now,
      count: products.length,
    }));

    return {
      success: true,
      count: products.length,
      lastSynced: now,
    };
  } catch (error) {
    console.error('Error syncing products:', error);
    return {
      success: false,
      count: 0,
      lastSynced: null,
    };
  }
}

// 마지막 동기화 시간 확인
export function getLastSyncTime(): string | null {
  const SYNC_KEY = 'itsmyturn:lp-market-sync';
  const syncData = localStorage.getItem(SYNC_KEY);
  if (!syncData) return null;
  
  try {
    const parsed = JSON.parse(syncData);
    return parsed.lastSynced || null;
  } catch {
    return null;
  }
}

// 하루가 지났는지 확인
export function shouldSync(): boolean {
  const lastSync = getLastSyncTime();
  if (!lastSync) return true;
  
  const lastSyncTime = new Date(lastSync).getTime();
  const now = new Date().getTime();
  const oneDay = 24 * 60 * 60 * 1000; // 24시간
  
  return (now - lastSyncTime) >= oneDay;
}

// 자동 동기화 체크 및 실행
export async function checkAndSyncIfNeeded(): Promise<boolean> {
  if (!shouldSync()) {
    return false;
  }

  const result = await syncProductsFromSupabase();
  return result.success;
}




