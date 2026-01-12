import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

async function listProducts() {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: products } = await supabase
        .from('lp_products')
        .select('id, title, artist')
        .limit(10);

    console.log('Products in DB:\n');
    products?.forEach((p, i) => {
        console.log(`${i + 1}. ${p.title} - ${p.artist}`);
    });
}

listProducts().catch(console.error);
