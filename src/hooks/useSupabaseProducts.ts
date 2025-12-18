
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { LpProduct } from '../data/lpMarket';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface UseSupabaseProductsResult {
    products: LpProduct[];
    totalCount: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

export const useSupabaseProducts = (
    searchQuery: string = '',
    page: number = 1,
    itemsPerPage: number = 20
): UseSupabaseProductsResult => {
    const [products, setProducts] = useState<LpProduct[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [trigger, setTrigger] = useState(0);

    const refetch = useCallback(() => {
        setTrigger((prev) => prev + 1);
    }, []);

    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // 검색어가 있으면 Edge Function 사용 (FTS)
                if (searchQuery.trim()) {
                    const { data, error: fnError } = await supabase.functions.invoke('search-lps', {
                        body: { q: searchQuery, page, limit: itemsPerPage },
                        method: 'GET',
                    });

                    if (fnError) throw fnError;

                    // Edge Function이 배열을 반환한다고 가정
                    // 실제로는 { products: [], total: number } 형태가 이상적이지만, 
                    // 현재 implementation plan의 edge function은 단순 배열 반환
                    // totalCount는 정확하지 않을 수 있음 (검색 결과 수)
                    const searchResults = Array.isArray(data) ? data : (data.products || []);

                    // 데이터 변환 (DB snake_case -> App camelCase)
                    const mappedProducts = searchResults.map(mapDbProductToAppProduct);

                    setProducts(mappedProducts);
                    setTotalCount(mappedProducts.length); // 임시로 length 사용
                } else {
                    // 검색어가 없으면 일반 DB 쿼리
                    const from = (page - 1) * itemsPerPage;
                    const to = from + itemsPerPage - 1;

                    const { data, count, error: dbError } = await supabase
                        .from('lp_products')
                        .select(`
                *,
                offers:lp_offers(
                    id,
                    vendor_name,
                    channel_id,
                    base_price,
                    shipping_fee,
                    url,
                    is_stock_available,
                    shipping_policy
                )
            `, { count: 'exact' })
                        .order('created_at', { ascending: false })
                        .range(from, to);

                    if (dbError) throw dbError;

                    setProducts((data || []).map(mapDbProductToAppProduct));
                    setTotalCount(count || 0);
                }
            } catch (err: any) {
                console.error('Failed to fetch products:', err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        };

        if (supabaseUrl && supabaseKey) {
            fetchProducts();
        } else {
            console.warn('Supabase env vars missing');
            setIsLoading(false);
        }
    }, [searchQuery, page, itemsPerPage, trigger]);

    return { products, totalCount, isLoading, error, refetch };
};

// DB 데이터를 앱 데이터 타입으로 변환하는 헬퍼
function mapDbProductToAppProduct(dbItem: any): LpProduct {
    return {
        id: dbItem.id,
        title: dbItem.title,
        artist: dbItem.artist,
        cover: dbItem.cover,
        category: dbItem.category,
        subCategory: dbItem.sub_category,
        discogsId: dbItem.discogs_id,
        barcode: dbItem.barcode,
        summary: dbItem.summary,

        // UI 필드 (DB에 없는 경우 기본값)
        color: 'Black', // DB에 추가 필요
        edition: 'Standard',
        country: 'EU',
        rarityIndex: 85, // 계산 로직 필요
        lpr: 0.12, // 계산 로직 필요

        priceHistory: [], // 별도 테이블 필요
        tags: [dbItem.category, dbItem.sub_category].filter(Boolean),

        // Offers 매핑
        offers: (dbItem.offers || []).map((o: any) => ({
            id: o.id || `offer-${Math.random()}`,
            vendorName: o.vendor_name,
            channelId: o.channel_id,
            basePrice: o.base_price,
            shippingFee: o.shipping_fee || 0,
            shippingPolicy: o.shipping_policy,
            url: o.url,
            inStock: o.is_stock_available,
            lastChecked: new Date().toISOString(),
            currency: 'KRW',
        })),

        // UI 파생 필드
        last30dChange: 0,
        pressingNotes: '',
        listeningNotes: [],
        preferredSetups: [],
        careTips: [],
        inventoryStatus: 'in-stock',
        restockVendors: [],
        priceFloorEstimate: 0,
        priceCeilingEstimate: 0,
        recommendedPairing: {
            turntable: 'Standard',
            cartridge: 'Moving Magnet',
            phonoStage: 'Built-in'
        },
        colorVariants: [],
        editionVariants: [],
    };
}
