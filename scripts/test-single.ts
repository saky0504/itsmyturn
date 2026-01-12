import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

// Import sync function
const { collectPricesForProduct } = await import('./sync-lp-data.js');

async function testSingleProduct() {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🔍 Getting first product from database\n');

    // Get any product
    const { data: product } = await supabase
        .from('lp_products')
        .select('*')
        .limit(1)
        .single();

    if (!product) {
        console.log('No products found');
        return;
    }

    console.log(`📀 Product: ${product.title} - ${product.artist}`);
    console.log(`   EAN: ${product.ean}\n`);

    // Collect prices
    console.log('🔄 Collecting prices...\n');

    const offers = await collectPricesForProduct({
        id: product.id,
        title: product.title,
        artist: product.artist,
        ean: product.ean
    });

    console.log(`\n📊 Results: Found ${offers?.length || 0} offers\n`);

    if (offers && offers.length > 0) {
        for (const offer of offers) {
            console.log(`✅ ${offer.vendorName}: ${offer.basePrice.toLocaleString()}원`);
            console.log(`   URL: ${offer.url}`);
            console.log('');
        }

        console.log('\n⚠️  사용자 확인 필요: 위 URL들이 실제 LP인지 확인해주세요.');
    } else {
        console.log('❌ No offers found');
    }
}

testSingleProduct().catch(console.error);
