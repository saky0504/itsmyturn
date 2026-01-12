import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

async function findRumours() {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
        .from('lp_products')
        .select('id, title, artist')
        .ilike('title', '%rumours%');

    console.log('Rumours products:');
    data?.forEach(p => {
        console.log(`- "${p.title}" by "${p.artist}"`);
    });
}

findRumours().catch(console.error);
