
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { LpProduct } from '../data/lpMarket';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface UseSupabaseProductsResult {
    products: LpProduct[];
    allProducts: LpProduct[]; // Added for global features like recommendations
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
    const [allProducts, setAllProducts] = useState<LpProduct[]>([]);

    const [products, setProducts] = useState<LpProduct[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [trigger, setTrigger] = useState(0);

    const refetch = useCallback(() => {
        setTrigger((prev) => prev + 1);
    }, []);

    // 1. 전체 데이터 한 번만 로드 (Client-side Search를 위해)
    useEffect(() => {
        const fetchAllProducts = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // 전체 데이터 로드 (최대 1000개 제한)
                const { data, error: dbError } = await supabase
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
                    `)
                    .order('created_at', { ascending: false })
                    .limit(1000);

                if (dbError) throw dbError;

                const mappedProducts = (data || []).map(mapDbProductToAppProduct);
                setAllProducts(mappedProducts);
            } catch (err: any) {
                console.error('Failed to fetch products:', err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        };

        if (supabaseUrl && supabaseKey) {
            fetchAllProducts();
        } else {
            console.warn('Supabase env vars missing');
            setIsLoading(false);
        }
    }, [trigger]); // trigger가 변경될 때만 재요청

    // 2. 검색어 필터링 및 페이지네이션 처리
    useEffect(() => {
        let result = allProducts;

        // 검색 필터링 (Client-side)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = allProducts.filter(p =>
                (p.title || '').toLowerCase().includes(query) ||
                (p.artist || '').toLowerCase().includes(query)
            );
        }

        setTotalCount(result.length);

        // 페이지네이션
        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage;
        setProducts(result.slice(from, to));

    }, [searchQuery, page, itemsPerPage, allProducts]);

    return { products, allProducts, totalCount, isLoading, error, refetch };
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
