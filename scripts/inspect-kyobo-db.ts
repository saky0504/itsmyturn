
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectKyobo() {
    console.log('🔍 Inspecting 20 Random Kyobo Offers...');

    // Fetch 20 Kyobo offers
    const { data: offers } = await supabase
        .from('lp_offers')
        .select(`
            id, 
            base_price, 
            url, 
            lp_products ( title, artist )
        `)
        .eq('vendor_name', '교보문고')
        .limit(20);

    if (!offers || offers.length === 0) {
        console.log('✅ No Kyobo offers found (Clean slate).');
        return;
    }

    console.log(`Found ${offers.length} offers. Listing details:\n`);

    offers.forEach((o: any) => {
        console.log(`Product: [${o.lp_products?.artist} - ${o.lp_products?.title}]`);
        console.log(`   Price: ${o.base_price}원`);
        console.log(`   URL: ${o.url}`);
        console.log('---');
    });
}

inspectKyobo();
