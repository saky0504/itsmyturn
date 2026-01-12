import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { throw new Error('Missing Supabase credentials'); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log('🧹 Cleaning up "Kind Of Blue" duplicates and invalid offers...\n');

    // Step 1: Get all "Kind Of Blue" products
    const { data: products } = await supabase
        .from('lp_products')
        .select('id, title, artist, ean, discogs_id')
        .ilike('title', '%Kind Of Blue%')
        .ilike('artist', '%Miles Davis%');

    if (!products || products.length === 0) {
        console.log('No products found.');
        return;
    }

    console.log(`Found ${products.length} duplicate products:`);
    products.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.id} - EAN: ${p.ean}, Discogs: ${p.discogs_id}`);
    });

    // Step 2: Keep the product with the most common EAN (886976805715)
    // This is the one with 16 offers, ID: dcf93963-26db-4990-93d4-025b4a714ee8
    const keepId = 'dcf93963-26db-4990-93d4-025b4a714ee8';
    const deleteIds = products.filter(p => p.id !== keepId).map(p => p.id);

    console.log(`\n✅ Keeping product: ${keepId}`);
    console.log(`❌ Deleting ${deleteIds.length} duplicate products...`);

    // Step 3: Delete duplicate products (cascade will delete their offers)
    if (deleteIds.length > 0) {
        const { error: delError } = await supabase
            .from('lp_products')
            .delete()
            .in('id', deleteIds);

        if (delError) {
            console.error('Error deleting products:', delError);
        } else {
            console.log(`✅ Deleted ${deleteIds.length} duplicate products.`);
        }
    }

    // Step 4: Clean up invalid offers for the kept product
    console.log(`\n🧹 Cleaning invalid offers for product ${keepId}...`);

    const { data: offers } = await supabase
        .from('lp_offers')
        .select('id, url, vendor_name, price')
        .eq('product_id', keepId);

    if (!offers) {
        console.log('No offers found.');
        return;
    }

    console.log(`Found ${offers.length} offers.`);

    // Identify invalid offers (search URLs, duplicates)
    const invalidOfferIds: string[] = [];
    const seenUrls = new Set<string>();

    offers.forEach(offer => {
        const url = offer.url || '';

        // Invalid: Kyobo search URLs
        if (url.includes('search.kyobobook.co.kr/search')) {
            invalidOfferIds.push(offer.id);
            console.log(`  ❌ Invalid (search URL): ${offer.vendor_name} - ${url.substring(0, 60)}...`);
            return;
        }

        // Invalid: Duplicate URLs
        if (seenUrls.has(url)) {
            invalidOfferIds.push(offer.id);
            console.log(`  ❌ Duplicate: ${offer.vendor_name} - ${url.substring(0, 60)}...`);
            return;
        }

        seenUrls.add(url);
    });

    console.log(`\n❌ Deleting ${invalidOfferIds.length} invalid/duplicate offers...`);

    if (invalidOfferIds.length > 0) {
        const { error: delOffersError } = await supabase
            .from('lp_offers')
            .delete()
            .in('id', invalidOfferIds);

        if (delOffersError) {
            console.error('Error deleting offers:', delOffersError);
        } else {
            console.log(`✅ Deleted ${invalidOfferIds.length} invalid offers.`);
        }
    }

    console.log('\n✅ Cleanup complete!');
    console.log(`Remaining valid offers: ${offers.length - invalidOfferIds.length}`);
}

cleanup().then(() => process.exit(0)).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
