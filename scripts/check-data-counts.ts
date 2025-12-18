
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

// Manual env parsing
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...val] = trimmed.split('=');
            if (key) process.env[key.trim()] = val.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
} catch (e) {
    console.log('No .env file found');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { count: products, error: pError } = await supabase
        .from('lp_products')
        .select('*', { count: 'exact', head: true });

    const { count: offers, error: oError } = await supabase
        .from('lp_offers')
        .select('*', { count: 'exact', head: true });

    // Check specifically for offers for existing products
    const { data: offersSample } = await supabase.from('lp_offers').select('id, product_id, vendor_name').limit(5);

    console.log('--- Database Status ---');
    if (pError) console.error('Products Error:', pError.message);
    else console.log(`✅ Products Count: ${products}`);

    if (oError) console.error('Offers Error:', oError.message);
    else console.log(`✅ Offers Count: ${offers}`);

    if (offersSample && offersSample.length > 0) {
        console.log('Sample Offers:', offersSample);
    } else {
        console.log('⚠️ No offers found in sample query.');
    }

    // Check RLS by trying with anon key if possible (simulating frontend)
    // But here we are using service role so we see everything.
}

checkData();
