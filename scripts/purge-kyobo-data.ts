
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeKyobo() {
    console.log('☢️  INITIATING TOTAL PURGE OF KYOBO DATA ☢️');
    console.log('Reason: Widespread invalid/generic link recommendations.');

    // Count before delete
    const { count: beforeCount } = await supabase
        .from('lp_offers')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_name', '교보문고');

    console.log(`Targeting ${beforeCount} Kyobo offers for deletion...`);

    const { error, count } = await supabase
        .from('lp_offers')
        .delete({ count: 'exact' })
        .eq('vendor_name', '교보문고');

    if (error) {
        console.error('❌ Purge Failed:', error);
    } else {
        console.log(`✅ PURGE COMPLETE. Deleted ${count} offers.`);
        console.log('   The Kyobo section is now clean.');
        console.log('   Running sync script will slowly repopulate valid items.');
    }
}

purgeKyobo();
