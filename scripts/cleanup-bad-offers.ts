
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase environment variables missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupBadOffers() {
    console.log('🧹 Cleaning up invalid low-price offers (< 10,000 KRW)...');

    // 1. Fetch all offers with price < 10000
    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, base_price, vendor_name, url')
        .lt('base_price', 10000); // 10,000 KRW threshold

    if (error) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    if (!offers || offers.length === 0) {
        console.log('✨ No bad offers found.');
        return;
    }

    console.log(`📋 Found ${offers.length} suspicious offers:`);
    offers.forEach(o => {
        console.log(`   - [${o.vendor_name}] Price: ${o.base_price} KRW (URL: ${o.url})`);
    });

    // 2. Delete them
    const idsToDelete = offers.map(o => o.id);
    const { error: deleteError } = await supabase
        .from('lp_offers')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error('❌ Failed to delete offers:', deleteError);
    } else {
        console.log(`✅ Successfully deleted ${idsToDelete.length} bad offers.`);
    }
}

cleanupBadOffers();
