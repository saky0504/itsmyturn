
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupStrictDuplicates() {
    console.log('🧹 [Strict Cleanup] Checking for duplicate offers (ignoring URL variations)...');

    // Fetch all offers
    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, product_id, vendor_name, base_price, url')
        .order('id', { ascending: true });

    if (error || !offers) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    const uniqueMap = new Map();
    const toDelete: string[] = [];

    for (const offer of offers) {
        // STRICT Key: Product + Vendor + Price (Ignore URL)
        const key = `${offer.product_id}-${offer.vendor_name}-${offer.base_price}`;

        if (uniqueMap.has(key)) {
            // Duplicate found -> Mark for deletion
            toDelete.push(offer.id);
        } else {
            uniqueMap.set(key, offer.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`📋 Found ${toDelete.length} strict duplicates to delete.`);

        const batchSize = 100;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: deleteError } = await supabase
                .from('lp_offers')
                .delete()
                .in('id', batch);

            if (deleteError) {
                console.error(`❌ Failed to delete batch ${i}:`, deleteError);
            } else {
                console.log(`✅ Deleted batch ${i / batchSize + 1} (${batch.length} items)`);
            }
        }
        console.log('✅ Strict duplicate cleanup complete.');
    } else {
        console.log('✨ No strict duplicates found.');
    }
}

import { cleanupMissingData } from './cleanup';

// ... (existing imports)

(async () => {
    // Also run missing data cleanup first
    await cleanupMissingData();
    await cleanupStrictDuplicates();
    process.exit(0);
})();
