
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase environment variables missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupBadData() {
    console.log('🧹 Cleaning up non-LP items (Posters, Merch, etc.)...');

    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, title, format');

    if (error) {
        console.error('❌ Failed to fetch products:', error);
        return;
    }

    const invalidKeywords = ['cd', 'compact disc', 'poster', 'book', 'magazine', 't-shirt', 'shirt', 'hoodie', 'apparel', 'merch', 'clothing', 'sticker', 'patch', 'badge', 'slipmat', 'totebag', 'cassette', 'tape', 'vhs', 'dvd', 'blu-ray'];

    const toDelete = [];

    for (const product of products) {
        const lowerTitle = (product.title || '').toLowerCase();
        const formats = (typeof product.format === 'string' ? product.format.split(',') : (Array.isArray(product.format) ? product.format : [])).map((f: string) => f.trim().toLowerCase());

        // Check title (allow "with poster")
        const hasInvalidTitle = invalidKeywords.some(k => lowerTitle.includes(k) && !lowerTitle.includes('with poster'));

        // Check format
        const hasInvalidFormat = formats.some(f => invalidKeywords.some(k => f.includes(k)));

        // Check if it lacks vinyl format (strict check)
        // Some might be empty format?
        const isVinyl = formats.some(f => f.includes('vinyl') || f.includes('lp') || f.includes('12"'));

        if (hasInvalidTitle || hasInvalidFormat || (formats.length > 0 && !isVinyl)) {
            console.log(`🗑️  Marked for deletion: ${product.title} (Format: ${product.format})`);
            toDelete.push(product.id);
        }
    }

    console.log(`\n📋 Found ${toDelete.length} items to delete.`);

    if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
            .from('lp_products')
            .delete()
            .in('id', toDelete);

        if (deleteError) {
            console.error('❌ Failed to delete items:', deleteError);
        } else {
            console.log('✅ Successfully deleted bad items.');
        }
    } else {
        console.log('✨ No bad items found.');
    }
}

cleanupBadData();
