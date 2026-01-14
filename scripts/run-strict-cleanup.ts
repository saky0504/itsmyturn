
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Validation Constants
const NON_MUSIC_KEYWORDS = [
    '원피스', 'dress', '티셔츠', 't-shirt', '후드', 'hoodie',
    '책', 'book', '만화', 'comic', '소설', 'novel',
    '체중계', 'scale', '체중', '저울', '블루투스', 'bluetooth', '스마트', 'smart',
    '인바디', 'inbody', '측정', 'measure', '디지털',
    '굿즈', 'goods', '키링', 'keyring', '패키지박스', '포토카드',
    'calendar', '달력', 'poster', '포스터'
];

async function cleanupBadData() {
    console.log('🧹 [Strict Cleanup] Starting comprehensive data validation...');

    // 1. Fetch all offers with product details
    // Note: We need to join manually or just fetch offers and check their titles/prices
    // For simplicity and performance, let's fetch offers and validate them.

    let { data: offers, error } = await supabase
        .from('lp_offers')
        .select('*');

    if (error || !offers) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    console.log(`🔍 Inspecting ${offers.length} offers...`);

    const toDelete: string[] = [];
    const reasonStats: Record<string, number> = {};

    for (const offer of offers) {
        let reason = null;

        // 1. Price Check
        if (offer.base_price < 15000 || offer.base_price > 1000000) {
            // Exception for some very expensive box sets? Maybe limit to 500k for safety or strict 1M.
            // User complained about Kyobo prices. Let's start with strict lower bound.
            reason = `Price out of range (${offer.base_price})`;
        }

        // 2. Keyword Check (if title is available in offer? No, usually not. Need to fetch or assume scraped data might be bad)
        // Ideally we should check the LINKED content or if we have title in lp_offers? 
        // lp_offers usually doesn't have title. We rely on the product. 
        // Wait, if the OFFER is wrong, it might be attached to the RIGHT product but pointing to WRONG URL.
        // We can't easily validate URL content without scraping. 
        // BUT we can check if we have any metadata stored? 
        // Current schema: lp_offers(id, product_id, vendor_name, base_price, url...)

        // If we can't check title, we can only check price. 
        // However, user said "Kyobo info is wrong". 
        // Let's assume some offers are just bad matches. 

        // Let's Look at Product Titles for context? 
        // If we want to clean 'products' that are not LPs, that's different.
        // User said "Kyobo price info is wrong". This implies the Link/Price is wrong for the LP.

        // Strict Filter Step: DELETE any offer < 20000 KRW (Unlikely to be new LP)
        if (offer.base_price < 20000) {
            reason = `Price too low (< 20000)`;
        }

        if (reason) {
            toDelete.push(offer.id);
            reasonStats[reason] = (reasonStats[reason] || 0) + 1;
            console.log(`❌ Mark for delete: [${offer.vendor_name}] ${offer.base_price} won - Reason: ${reason} (ID: ${offer.id})`);
        }
    }

    // Execute Deletion
    if (toDelete.length > 0) {
        console.log(`🗑️ Deleting ${toDelete.length} invalid offers...`);
        // Batch delete
        const batchSize = 100;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: delError } = await supabase
                .from('lp_offers')
                .delete()
                .in('id', batch);

            if (delError) console.error(`Failed batch delete:`, delError);
            else console.log(`Deleted batch ${i / batchSize + 1}`);
        }
    } else {
        console.log('✅ No obvious invalid offers found (by price).');
    }
}

// Also Check Products for Non-Music Keywords
async function cleanupBadProducts() {
    console.log('🧹 [Strict Cleanup] Checking Products for invalid keywords...');

    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, title');

    if (!products) return;

    const toDelete: string[] = [];

    for (const p of products) {
        const lowerTitle = p.title.toLowerCase();
        if (NON_MUSIC_KEYWORDS.some(k => lowerTitle.includes(k))) {
            console.log(`❌ Invalid Product Found: ${p.title} (ID: ${p.id})`);
            toDelete.push(p.id);
        }
    }

    if (toDelete.length > 0) {
        console.log(`🗑️ Deleting ${toDelete.length} invalid products...`);
        const { error: delError } = await supabase
            .from('lp_products')
            .delete()
            .in('id', toDelete);
        if (delError) console.error('Delete failed:', delError);
        else console.log('✅ Deleted invalid products.');
    } else {
        console.log('✅ No invalid products found.');
    }
}

(async () => {
    await cleanupBadData();
    await cleanupBadProducts();
    process.exit(0);
})();
