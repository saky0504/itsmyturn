
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeDeletion() {
    console.log('🚨 EXECUTING DELETION OF SHARED URLS (MANY-TO-ONE) 🚨');

    // 1. Identify Duplicates again (Safety Check)
    const { data: offers } = await supabase
        .from('lp_offers')
        .select('id, url, product_id');

    if (!offers) return;

    const urlMap = new Map<string, Set<string>>();
    const urlToIds = new Map<string, string[]>();

    offers.forEach(o => {
        if (!o.url) return;
        const u = o.url.trim();
        if (!urlMap.has(u)) {
            urlMap.set(u, new Set());
            urlToIds.set(u, []);
        }
        urlMap.get(u)?.add(o.product_id);
        urlToIds.get(u)?.push(o.id);
    });

    const idsToDelete: string[] = [];
    for (const [url, products] of urlMap.entries()) {
        if (products.size > 1) {
            idsToDelete.push(...(urlToIds.get(url) || []));
        }
    }

    console.log(`Targeting ${idsToDelete.length} offers for deletion...`);

    if (idsToDelete.length === 0) {
        console.log('No duplicates found.');
        return;
    }

    // 2. Delete in batches
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const { error } = await supabase
            .from('lp_offers')
            .delete()
            .in('id', batch);

        if (error) console.error('Delete error:', error);
        else console.log(`Deleted batch ${i / batchSize + 1}`);
    }

    console.log('✅ Deletion Complete.');
}

executeDeletion();
