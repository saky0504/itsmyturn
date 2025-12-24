
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ProductIdentifier {
    ean?: string;
    title?: string;
    artist?: string;
    discogsId?: number;
}

interface VendorOffer {
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

async function fetchKyoboPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
    try {
        const keyword = identifier.ean || `${identifier.artist} ${identifier.title} LP`;
        const searchUrl = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(keyword)}&gbCode=TOT&target=total`;

        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) return null;

        const html = await response.text();
        const $ = cheerio.load(html);

        const priceText = $('.prod_price .price .val').first().text().replace(/[^0-9]/g, '');
        const price = priceText ? parseInt(priceText) : 0;

        if (!price) return null;

        let productLink = $('.prod_link').first().attr('href');

        if (productLink) {
            if (!productLink.startsWith('http')) {
                productLink = `https://product.kyobobook.co.kr${productLink.startsWith('/') ? '' : '/'}${productLink}`;
            }
        } else {
            productLink = searchUrl;
        }

        return {
            vendorName: '교보문고',
            channelId: 'mega-book',
            basePrice: price,
            shippingFee: 0,
            shippingPolicy: '5만원 이상 무료배송',
            url: productLink,
            inStock: true,
            affiliateCode: 'itsmyturn',
            affiliateParamKey: 'KyoboCode'
        };

    } catch (error) {
        return null;
    }
}

async function forceSyncKyobo() {
    console.log('🚀 Starting Force Sync for Kyobo Bookstore...');

    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, ean, discogs_id, title, artist');

    if (error || !products) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`📦 Found ${products.length} products.`);

    let updatedCount = 0;

    // Process sequentially to be safe
    for (const [index, product] of products.entries()) {
        const identifier: ProductIdentifier = {
            ean: product.ean || undefined,
            title: product.title || undefined,
            artist: product.artist || undefined
        };

        const offer = await fetchKyoboPrice(identifier);

        if (offer) {
            // Delete existing Kyobo offer only
            await supabase
                .from('lp_offers')
                .delete()
                .eq('product_id', product.id)
                .eq('vendor_name', '교보문고');

            // Insert new offer
            const { error: insertError } = await supabase
                .from('lp_offers')
                .insert({
                    product_id: product.id,
                    vendor_name: '교보문고',
                    channel_id: 'mega-book',
                    price: offer.basePrice,
                    base_price: offer.basePrice,
                    currency: 'KRW',
                    shipping_fee: offer.shippingFee,
                    shipping_policy: offer.shippingPolicy,
                    url: offer.url,
                    is_stock_available: offer.inStock,
                    last_checked: new Date().toISOString()
                });

            if (!insertError) {
                console.log(`[${index + 1}/${products.length}] 🔗 Link Fixed & Updated: ${product.title.substring(0, 15)}... (${offer.url.substring(0, 40)}...)`);
                updatedCount++;
            } else {
                console.error(`[${index + 1}/${products.length}] ❌ Insert failed for ${product.id}`);
            }
        } else {
            console.log(`[${index + 1}/${products.length}] 💨 No Kyobo result for: ${product.title.substring(0, 20)}...`);
        }

        // Slight delay to be polite
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n🎉 Completed! Updated ${updatedCount} products.`);
}

forceSyncKyobo().catch(console.error);
