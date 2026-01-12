import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

async function analyzeLowSuccessRate() {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🔍 Analyzing Low Success Rate\n');

    // Get sample products WITHOUT offers
    const { data: allProducts } = await supabase
        .from('lp_products')
        .select('id, title, artist')
        .limit(1000);

    const { data: offersData } = await supabase
        .from('lp_offers')
        .select('product_id');

    const productIdsWithOffers = new Set(offersData?.map(o => o.product_id));

    const productsWithoutOffers = allProducts?.filter(p => !productIdsWithOffers.has(p.id)) || [];

    console.log(`📊 Statistics:`);
    console.log(`   Total products: ${allProducts?.length}`);
    console.log(`   Products WITH offers: ${productIdsWithOffers.size}`);
    console.log(`   Products WITHOUT offers: ${productsWithoutOffers.length}`);
    console.log('');

    console.log('📀 Sample products WITHOUT offers:');
    productsWithoutOffers.slice(0, 20).forEach((p, i) => {
        console.log(`${i + 1}. ${p.title} - ${p.artist}`);
    });

    console.log('\n📀 Sample products WITH offers:');
    const productsWithOffers = allProducts?.filter(p => productIdsWithOffers.has(p.id)) || [];
    productsWithOffers.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.title} - ${p.artist}`);
    });
}

analyzeLowSuccessRate().catch(console.error);
