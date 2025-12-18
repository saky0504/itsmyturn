
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { LpProduct } from '../data/lpMarket';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface UseSupabaseAlbumResult {
    product: LpProduct | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

export const useSupabaseAlbum = (id: string | undefined): UseSupabaseAlbumResult => {
    const [product, setProduct] = useState<LpProduct | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [trigger, setTrigger] = useState(0);

    const refetch = useCallback(() => {
        setTrigger((prev) => prev + 1);
    }, []);

    useEffect(() => {
        if (!id) {
            setProduct(null);
            setIsLoading(false);
            return;
        }

        const fetchProduct = async () => {
            setIsLoading(true);
            setError(null);

            try {
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
                    shipping_policy,
                    badge,
                    updated_at
                )
            `)
                    .eq('id', id)
                    .single();

                if (dbError) throw dbError;

                if (data) {
                    setProduct(mapDbProductToAppProduct(data));
                } else {
                    setProduct(null);
                }
            } catch (err: any) {
                console.error('Failed to fetch album:', err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        };

        if (supabaseUrl && supabaseKey) {
            fetchProduct();
        }
    }, [id, trigger]);

    return { product, isLoading, error, refetch };
};

function mapDbProductToAppProduct(dbItem: any): LpProduct {
    return {
        id: dbItem.id,
        title: dbItem.title,
        artist: dbItem.artist,
        cover: dbItem.cover,
        category: dbItem.format || 'Vinyl', // Map 'format' from DB
        subCategory: (dbItem.styles && dbItem.styles[0]) || (dbItem.genres && dbItem.genres[0]) || '', // Map style/genre
        discogsId: dbItem.discogs_id,
        barcode: dbItem.ean, // Map 'ean' from DB
        summary: dbItem.description, // Map 'description' from DB

        color: 'Black',
        edition: 'Standard',
        country: 'EU',
        rarityIndex: 85,
        lpr: 0.12,
        last30dChange: 0,
        priceHistory: [],
        pressingNotes: '',
        listeningNotes: [],
        preferredSetups: [],
        careTips: [],
        inventoryStatus: 'in-stock',
        restockVendors: [],
        priceFloorEstimate: 0,
        priceCeilingEstimate: 0,
        recommendedPairing: { turntable: '', cartridge: '', phonoStage: '' },
        tags: [...(dbItem.genres || []), ...(dbItem.styles || [])],

        offers: (dbItem.offers || []).map((o: any) => ({
            id: o.id,
            vendorName: o.vendor_name,
            channelId: o.channel_id,
            basePrice: o.base_price,
            shippingFee: o.shipping_fee || 0,
            shippingPolicy: o.shipping_policy,
            url: o.url,
            inStock: o.is_stock_available,
            lastChecked: o.updated_at || new Date().toISOString(),
            currency: 'KRW',
            notes: o.shipping_policy, // Fallback/Use shipping policy as notes if needed
            badge: o.badge
        })),

        colorVariants: [],
        editionVariants: [],
    };
}
