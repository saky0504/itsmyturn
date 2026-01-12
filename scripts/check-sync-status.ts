import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

async function checkSyncStatus() {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('📊 Sync Status Report\n');

    // Get total products
    const { count: productCount } = await supabase
        .from('lp_products')
        .select('*', { count: 'exact', head: true });

    console.log(`📀 Total Products: ${productCount}`);

    // Get total offers
    const { count: offerCount } = await supabase
        .from('lp_offers')
        .select('*', { count: 'exact', head: true });

    console.log(`💰 Total Offers: ${offerCount}`);

    // Get offers by vendor
    const { data: offers } = await supabase
        .from('lp_offers')
        .select('vendor_name');

    const vendorCounts: Record<string, number> = {};
    offers?.forEach(offer => {
        vendorCounts[offer.vendor_name] = (vendorCounts[offer.vendor_name] || 0) + 1;
    });

    console.log('\n📊 Offers by Vendor:');
    Object.entries(vendorCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([vendor, count]) => {
            console.log(`   ${vendor}: ${count}`);
        });

    // Get products without offers
    const { data: productsWithoutOffers } = await supabase
        .from('lp_products')
        .select('id, title, artist')
        .not('id', 'in', `(SELECT DISTINCT product_id FROM lp_offers)`);

    console.log(`\n⚠️  Products without offers: ${productsWithoutOffers?.length || 0}`);

    if (productsWithoutOffers && productsWithoutOffers.length > 0) {
        console.log('\nSample products without offers:');
        productsWithoutOffers.slice(0, 5).forEach(p => {
            console.log(`   - ${p.title} by ${p.artist}`);
        });
    }

    // Calculate coverage
    const coverage = productCount ? ((productCount - (productsWithoutOffers?.length || 0)) / productCount * 100).toFixed(1) : 0;
    console.log(`\n📈 Coverage: ${coverage}% of products have at least one offer`);
}

checkSyncStatus().catch(console.error);
