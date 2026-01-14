
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function deduplicateOffers() {
    console.log('🧹 Removing Internal Duplicates (Keeping 1 per URL/Product)...');

    const { data: offers } = await supabase
        .from('lp_offers')
        .select('id, product_id, url');

    if (!offers) return;

    const seenKey = new Set<string>();
    const idsToDelete: string[] = [];
    let keptCount = 0;

    offers.forEach(o => {
        if (!o.url || !o.product_id) return;

        // Key based on Product + URL
        const key = `${o.product_id}|${o.url.trim()}`;

        if (seenKey.has(key)) {
            // Duplicate!
            idsToDelete.push(o.id);
        } else {
            // Keep this one
            seenKey.add(key);
            keptCount++;
        }
    });

    console.log(`Analyzing ${offers.length} offers...`);
    console.log(`   Keeping: ${keptCount}`);
    console.log(`   Deleting: ${idsToDelete.length} duplicates`);

    if (idsToDelete.length > 0) {
        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            const { error } = await supabase.from('lp_offers').delete().in('id', batch);
            if (error) console.error('Error deleting:', error);
            else console.log(`Deleted batch ${i / batchSize + 1}`);
        }
        console.log('✅ Deduplication Complete.');
    } else {
        console.log('✅ No duplicates found.');
    }
}

deduplicateOffers();
