import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { throw new Error('Missing Supabase credentials'); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAja() {
    console.log('🔍 Checking "Aja" product in database...\n');

    const { data: products } = await supabase
        .from('lp_products')
        .select('id, title, artist, ean')
        .ilike('title', '%Aja%')
        .limit(5);

    if (!products || products.length === 0) {
        console.log('No "Aja" products found.');
        return;
    }

    console.log(`Found ${products.length} products with "Aja" in title:\n`);
    products.forEach((p, i) => {
        console.log(`${i + 1}. "${p.title}" - ${p.artist}`);
        console.log(`   EAN: ${p.ean || 'N/A'}\n`);
    });
}

checkAja().catch(console.error);
