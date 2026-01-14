
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

async function pruneDuplicateUrls() {
    console.log('🔍 Analyzing offers for shared URLs (Many-to-One Error)...');

    // Fetch all offers with URL and product_id
    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, url, product_id, vendor_name');

    if (error || !offers) {
        console.error('❌ Failed to fetch offers:', error);
        return;
    }

    // Group by URL
    const urlMap = new Map<string, Set<string>>(); // URL -> Set of Product IDs
    const urlToOfferIds = new Map<string, string[]>(); // URL -> List of Offer IDs

    offers.forEach(offer => {
        if (!offer.url) return;

        // Normalize URL (ignore query params sometimes? No, strict match for now)
        const url = offer.url.trim();

        if (!urlMap.has(url)) {
            urlMap.set(url, new Set());
            urlToOfferIds.set(url, []);
        }
        urlMap.get(url)?.add(offer.product_id);
        urlToOfferIds.get(url)?.push(offer.id);
    });

    const toDelete: string[] = [];

    // Find URLs used by more than 1 DISTINCT product
    for (const [url, productIds] of urlMap.entries()) {
        if (productIds.size > 1) {
            console.log(`❌ URL Shared by ${productIds.size} products: ${url}`);
            const offerIds = urlToOfferIds.get(url) || [];
            toDelete.push(...offerIds);
        }
    }

    if (toDelete.length > 0) {
        console.log(`🗑️ Found ${toDelete.length} offers with shared URLs. Deleting...`);

        const batchSize = 100;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: delError } = await supabase
                .from('lp_offers')
                .delete()
                .in('id', batch);

            if (delError) console.error('Delete failed:', delError);
            else console.log(`Deleted batch ${i / batchSize + 1}`);
        }
        console.log('✅ Cleanup complete. Shared URLs removed.');
    } else {
        console.log('✅ No shared URLs found. Data looks clean.');
    }
}

pruneDuplicateUrls();
