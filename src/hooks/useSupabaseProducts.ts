
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { LpProduct } from '../data/lpMarket';
import { supabase } from '../lib/supabase'; // Singleton import

const LOAD_STEP = 20;

export interface UseSupabaseProductsResult {
    products: LpProduct[];
    allProducts: LpProduct[]; // Added for global features like recommendations
    totalCount: number;
    visibleCount: number;
    hasMore: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: Error | null;
    refetch: () => void;
    loadMore: () => void;
    resetVisible: () => void;
}

export const useSupabaseProducts = (
    searchQuery: string = '',
): UseSupabaseProductsResult => {
    const [allProducts, setAllProducts] = useState<LpProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [trigger, setTrigger] = useState(0);
    const [visibleCount, setVisibleCount] = useState(LOAD_STEP);

    const refetch = useCallback(() => {
        setTrigger((prev) => prev + 1);
    }, []);

    const resetVisible = useCallback(() => {
        setVisibleCount(LOAD_STEP);
    }, []);

    // 1. 전체 데이터 한 번만 로드
    useEffect(() => {
        const fetchAllProducts = async () => {
            setIsLoading(true);
            setError(null);

            try {
                let allFetchedData: any[] = [];
                let hasMoreRecords = true;
                let page = 0;
                const pageSize = 1000;

                while (hasMoreRecords) {
                    const { data, error: dbError } = await supabase
                        .from('lp_products')
                        .select(`
                            id, title, artist, cover, category, sub_category, discogs_id, barcode, summary,
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
                        .range(page * pageSize, (page + 1) * pageSize - 1);

                    if (dbError) throw dbError;

                    if (data && data.length > 0) {
                        allFetchedData = [...allFetchedData, ...data];
                        if (data.length < pageSize) {
                            hasMoreRecords = false;
                        } else {
                            page++;
                        }
                    } else {
                        hasMoreRecords = false;
                    }
                }

                const mappedProducts = allFetchedData.map(mapDbProductToAppProduct);
                setAllProducts(mappedProducts);
            } catch (err: unknown) {
                console.error('Failed to fetch products:', err);
                setError(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllProducts();
    }, [trigger]);

    // 2. 검색어 변경 시 visibleCount 리셋
    useEffect(() => {
        setVisibleCount(LOAD_STEP);
    }, [searchQuery]);

    // 3. 검색 필터링 (client-side)
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return allProducts;
        const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();
        const normalizedQuery = normalize(searchQuery);
        return allProducts.filter(p => {
            const normalizedTitle = normalize(p.title || '');
            const normalizedArtist = normalize(p.artist || '');
            return normalizedTitle.includes(normalizedQuery) || normalizedArtist.includes(normalizedQuery);
        });
    }, [searchQuery, allProducts]);

    const totalCount = filteredProducts.length;
    const hasMore = visibleCount < totalCount;
    const products = filteredProducts.slice(0, visibleCount);

    const loadMore = useCallback(() => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        // small async tick to allow UI to update before computing next slice
        setTimeout(() => {
            setVisibleCount(prev => prev + LOAD_STEP);
            setIsLoadingMore(false);
        }, 200);
    }, [isLoadingMore, hasMore]);

    return { products, allProducts, totalCount, visibleCount, hasMore, isLoading, isLoadingMore, error, refetch, loadMore, resetVisible };
};

interface DbOffer {
    id: string;
    vendor_name: string;
    channel_id: string;
    base_price: number;
    shipping_fee: number;
    shipping_policy: string;
    url: string;
    is_stock_available: boolean;
    updated_at?: string;
}

interface DbProduct {
    id: string;
    title: string;
    artist: string;
    cover: string;
    category: string;
    sub_category: string;
    discogs_id: string;
    barcode: string;
    summary: string;
    offers?: DbOffer[];
}

// DB 데이터를 앱 데이터 타입으로 변환하는 헬퍼
function mapDbProductToAppProduct(dbItem: DbProduct): LpProduct {
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
        color: 'Black',
        edition: 'Standard',
        country: 'EU',
        rarityIndex: 85,
        lpr: 0.12,

        priceHistory: [],
        tags: [dbItem.category, dbItem.sub_category].filter(Boolean),

        // Offers 매핑
        offers: (dbItem.offers || []).map((o: DbOffer) => ({
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
