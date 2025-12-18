export interface LpProduct {
    id: string; // UUID
    ean?: string | null;
    title: string;
    artist: string;
    release_date?: string | null;
    label?: string | null;
    cover?: string | null;
    thumbnail_url?: string | null;
    format?: string | null;
    genres?: string[] | null;
    styles?: string[] | null;
    track_list?: {
        position: string;
        title: string;
        duration: string;
    }[] | null;
    discogs_id?: string | null;
    description?: string | null;
    created_at: string;
    updated_at: string;
    last_synced_at?: string | null;
}

export interface LpOffer {
    id: string; // UUID
    product_id: string;
    vendor_name: string;
    channel_id: string;
    price: number;
    base_price?: number | null;
    currency: string;
    shipping_fee: number;
    shipping_policy?: string | null;
    url: string;
    affiliate_url?: string | null;
    is_stock_available: boolean;
    badge?: 'fresh' | 'lowest' | 'exclusive' | 'best' | null;
    last_checked: string;
    created_at: string;
    updated_at: string;
}
