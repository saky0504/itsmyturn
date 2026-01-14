
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeCoupang() {
    console.log('☢️  PURGING ALL COUPANG OFFERS ☢️');

    const { count, error } = await supabase
        .from('lp_offers')
        .delete({ count: 'exact' })
        .like('url', '%coupang%');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`✅ Deleted ${count} Coupang offers.`);
    }
}

purgeCoupang();
