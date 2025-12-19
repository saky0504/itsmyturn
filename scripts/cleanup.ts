
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables if running directly
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase environment variables missing');
    // Don't exit here if imported, but functions will fail
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

/**
 * Remove products that are not LPs (CDs, posters, merch)
 */
export async function cleanupBadProducts() {
    console.log('🧹 [Cleanup] Checking for non-LP items (Posters, Merch, etc.)...');

    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, title, format');

    if (error) {
        console.error('❌ Failed to fetch products:', error);
        return;
    }

    const invalidKeywords = ['cd', 'compact disc', 'poster', 'book', 'magazine', 't-shirt', 'shirt', 'hoodie', 'apparel', 'merch', 'clothing', 'sticker', 'patch', 'badge', 'slipmat', 'totebag', 'cassette', 'tape', 'vhs', 'dvd', 'blu-ray'];

    const toDelete: string[] = [];

    for (const product of products) {
        const lowerTitle = (product.title || '').toLowerCase();
        const formats = (typeof product.format === 'string' ? product.format.split(',') : (Array.isArray(product.format) ? product.format : [])).map((f: string) => f.trim().toLowerCase());

        // Check title (allow "with poster")
        const hasInvalidTitle = invalidKeywords.some(k => lowerTitle.includes(k) && !lowerTitle.includes('with poster'));

        // Check format
        const hasInvalidFormat = formats.some((f: string) => invalidKeywords.some(k => f.includes(k)));

        // Check if it lacks vinyl format (strict check)
        const isVinyl = formats.some((f: string) => f.includes('vinyl') || f.includes('lp') || f.includes('12"'));

        if (hasInvalidTitle || hasInvalidFormat || (formats.length > 0 && !isVinyl)) {
            // console.log(`🗑️  Marked for deletion: ${product.title} (Format: ${product.format})`);
            toDelete.push(product.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`📋 Found ${toDelete.length} invalid products to delete.`);
        const { error: deleteError } = await supabase
            .from('lp_products')
            .delete()
            .in('id', toDelete);

        if (deleteError) {
            console.error('❌ Failed to delete products:', deleteError);
        } else {
            console.log('✅ Successfully deleted bad products.');
        }
    } else {
        console.log('✨ No bad products found.');
    }
}

/**
 * Remove offers with abnormally low prices
 */
export async function cleanupBadOffers() {
    console.log('🧹 [Cleanup] Checking for invalid low-price offers (< 10,000 KRW)...');

    // 1. Fetch all offers with price < 10000
    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, base_price, vendor_name, url')
        .lt('base_price', 10000); // 10,000 KRW threshold

    if (error) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    if (!offers || offers.length === 0) {
        console.log('✨ No bad offers found.');
        return;
    }

    console.log(`📋 Found ${offers.length} suspicious offers.`);

    // 2. Delete them
    const idsToDelete = offers.map(o => o.id);
    const { error: deleteError } = await supabase
        .from('lp_offers')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error('❌ Failed to delete offers:', deleteError);
    } else {
        console.log(`✅ Successfully deleted ${idsToDelete.length} bad offers.`);
    }
}
