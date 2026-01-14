
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeKyoboRobust() {
    console.log('☢️  RE-INITIATING ROBUST PURGE OF KYOBO DATA ☢️');

    // 1. Delete by Vendor Name
    const { count: countName, error: errName } = await supabase
        .from('lp_offers')
        .delete({ count: 'exact' })
        .eq('vendor_name', '교보문고');

    if (errName) console.error('Error deleting by vendor_name:', errName);
    else console.log(`Deleted ${countName} offers by vendor_name='교보문고'`);

    // 2. Delete by URL Pattern (Catch-all for hottracks/kyobo URLs)
    const { count: countUrl, error: errUrl } = await supabase
        .from('lp_offers')
        .delete({ count: 'exact' })
        .like('url', '%kyobobook.co.kr%');

    if (errUrl) console.error('Error deleting by URL pattern:', errUrl);
    else console.log(`Deleted ${countUrl} offers by URL like '%kyobobook.co.kr%'`);

    // 3. Verify specific bad URL is gone
    const { count: checkCount } = await supabase
        .from('lp_offers')
        .select('*', { count: 'exact', head: true })
        .like('url', '%0806417100322%');

    console.log(`Remaining '0806417100322' offers: ${checkCount}`);
}

purgeKyoboRobust();
