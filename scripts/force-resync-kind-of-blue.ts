import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { collectPricesForProduct } from './sync-lp-data';

config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { throw new Error('Missing Supabase credentials'); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceResync() {
    const productId = 'dcf93963-26db-4990-93d4-025b4a714ee8';

    console.log('🗑️  Deleting ALL existing offers for Kind Of Blue...');

    const { error: delError } = await supabase
        .from('lp_offers')
        .delete()
        .eq('product_id', productId);

    if (delError) {
        console.error('Delete error:', delError);
        return;
    }

    console.log('✅ All offers deleted.');
    console.log('\n🔄 Re-syncing with corrected validation logic...');

    const identifier = {
        ean: '886976805715',
        discogsId: '2825456',
        title: 'Kind Of Blue',
        artist: 'Miles Davis'
    };

    const offers = await collectPricesForProduct(identifier);

    console.log(`\n📊 Found ${offers.length} valid offers.`);

    if (offers.length > 0) {
        const offersToInsert = offers.map(offer => ({
            product_id: productId,
            vendor_name: offer.vendorName,
            channel_id: offer.channelId,
            base_price: offer.basePrice,
            price: offer.basePrice,
            currency: 'KRW',
            shipping_fee: offer.shippingFee,
            shipping_policy: offer.shippingPolicy,
            url: offer.url,
            is_stock_available: offer.inStock,
            last_checked: new Date().toISOString()
        }));

        const { error: insError } = await supabase
            .from('lp_offers')
            .insert(offersToInsert);

        if (insError) {
            console.error('Insert error:', insError);
        } else {
            console.log(`✅ Inserted ${offers.length} valid offers.`);
            offers.forEach(o => {
                console.log(`   - ${o.vendorName}: ${o.basePrice}원`);
            });
        }
    } else {
        console.log('⚠️  No valid offers found. This may indicate the validation is too strict or vendors don\'t have this product.');
    }
}

forceResync().then(() => process.exit(0)).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
