import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
    const { data, error } = await supabase.from('lp_offers').select('*').limit(10);
    console.log('Error:', error);
    console.log(`Found ${data?.length} rows in lp_offers cache right now`);
    if (data && data.length > 0) {
        console.log('First row example:', data[0]);

        console.log('Trying to wipe with true SQL delete...');
        const { error: delError } = await supabase.from('lp_offers').delete().neq('price', -1);
        console.log('Delete error:', delError);

        // Fall back to a bulk delete via loop if supabase RLS prevents neq delete
        const { data: allData } = await supabase.from('lp_offers').select('id');
        if (allData && allData.length > 0) {
            console.log(`Manually deleting ${allData.length} rows...`);
            for (const row of allData) {
                await supabase.from('lp_offers').delete().eq('id', row.id);
            }
            console.log('Finished manual wipe.');
        }
    }
}

check();
