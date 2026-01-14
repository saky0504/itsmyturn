
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRemaining() {
    console.log('🔍 Inspecting Remaining 75 Offers...');

    const { data: offers } = await supabase
        .from('lp_offers')
        .select('id, vendor_name, product_id, url')
        .order('product_id');

    if (!offers) return;

    console.log(`Found ${offers.length} offers.`);

    // Group by product to see "effective" duplicates for a user
    const byProduct = new Map<string, any[]>();
    offers.forEach(o => {
        if (!byProduct.has(o.product_id)) byProduct.set(o.product_id, []);
        byProduct.get(o.product_id)?.push(o);
    });

    for (const [pid, items] of byProduct.entries()) {
        if (items.length > 1) {
            console.log(`\nProduct ${pid} has ${items.length} offers:`);
            items.forEach(item => {
                console.log(`   - [${item.vendor_name}] ${item.url}`);
            });
        }
    }
}

inspectRemaining();
