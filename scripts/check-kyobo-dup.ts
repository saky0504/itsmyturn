
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const urlPattern = '%0806417100322%';

    const { count, error } = await supabase
        .from('lp_offers')
        .select('*', { count: 'exact', head: true })
        .like('url', urlPattern);

    if (error) console.error(error);
    else console.log(`Remaining offers with URL pattern '${urlPattern}': ${count}`);
}

check();
