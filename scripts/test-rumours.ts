import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const { collectPricesForProduct } = await import('./sync-lp-data.js');

async function testRumours() {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: products } = await supabase
        .from('lp_products')
        .select('*')
        .ilike('title', '%rumours%')
        .limit(1);

    const product = products?.[0];

    if (!product) {
        console.log('Product not found');
        return;
    }

    console.log(`📀 Testing: ${product.title} - ${product.artist}\n`);

    const offers = await collectPricesForProduct({
        id: product.id,
        title: product.title,
        artist: product.artist,
        ean: product.ean
    });

    console.log(`\n📊 Found ${offers?.length || 0} offers:\n`);

    if (offers && offers.length > 0) {
        for (const offer of offers) {
            console.log(`${offer.vendorName}: ${offer.basePrice.toLocaleString()}원`);
            console.log(`URL: ${offer.url}\n`);
        }
    }
}

testRumours().catch(console.error);
