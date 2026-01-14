
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeInternalDuplicates() {
    console.log('🔍 Analyzing Internal Duplicates (Same Product, Same URL)...');

    const { data: offers } = await supabase
        .from('lp_offers')
        .select('id, product_id, url');

    if (!offers) return;

    // Map: ProductID -> (URL -> Count)
    const productUrlMap = new Map<string, Map<string, number>>();
    let duplicateCount = 0;

    offers.forEach(o => {
        if (!o.url) return;

        if (!productUrlMap.has(o.product_id)) {
            productUrlMap.set(o.product_id, new Map());
        }

        const urlMap = productUrlMap.get(o.product_id)!;
        const currentCount = urlMap.get(o.url) || 0;

        if (currentCount > 0) {
            duplicateCount++;
        }
        urlMap.set(o.url, currentCount + 1);
    });

    console.log(`\n📊 Internal Duplicate Report:`);
    console.log(`   Total Offers Checked: ${offers.length}`);
    console.log(`   Redundant Rows Found: ${duplicateCount}`);

    if (duplicateCount > 0) {
        console.log(`\n⚠️  Found ${duplicateCount} useless duplicate rows within the same products.`);
        console.log(`   (e.g. Product A has the same link listed 2+ times)`);
    } else {
        console.log(`✅ No internal duplicates found.`);
    }
}

analyzeInternalDuplicates();
