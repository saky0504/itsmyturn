
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDuplicates() {
    console.log('🔍 Analyzing System-wide Duplicate URLs...');

    const { data: offers, error } = await supabase
        .from('lp_offers')
        .select('id, url, product_id, vendor_name');

    if (error || !offers) {
        console.error('❌ Failed to fetch:', error);
        return;
    }

    // Grouping
    const urlMap = new Map<string, Set<string>>(); // URL -> Product IDs
    const urlVendorMap = new Map<string, string>(); // URL -> Vendor Name
    const urlOfferCount = new Map<string, number>(); // URL -> Offer Count

    offers.forEach(o => {
        if (!o.url) return;
        const u = o.url.trim();
        if (!urlMap.has(u)) {
            urlMap.set(u, new Set());
            urlVendorMap.set(u, o.vendor_name);
            urlOfferCount.set(u, 0);
        }
        urlMap.get(u)?.add(o.product_id);
        urlOfferCount.set(u, (urlOfferCount.get(u) || 0) + 1);
    });

    const badUrls = [];
    for (const [url, products] of urlMap.entries()) {
        if (products.size > 1) {
            badUrls.push({
                url,
                vendor: urlVendorMap.get(url),
                productCount: products.size,
                offerCount: urlOfferCount.get(url)
            });
        }
    }

    // Sort by "how many products share this link" (worst offenders first)
    badUrls.sort((a, b) => b.productCount - a.productCount);

    console.log(`\n🚨 FOUND ${badUrls.length} BAD SHARED URLS`);
    console.log(`   (These are generic links assigned to multiple different products)\n`);

    if (badUrls.length > 0) {
        console.log('TOP 10 OFFENDERS:');
        badUrls.slice(0, 10).forEach((b, i) => {
            console.log(`${i + 1}. [${b.vendor}] Linked to ${b.productCount} products (Total ${b.offerCount} offers)`);
            console.log(`   URL: ${b.url.substring(0, 80)}...`);
        });

        const totalOffersToDelete = badUrls.reduce((sum, b) => sum + (b.offerCount || 0), 0);
        console.log(`\n💥 TOTAL IMPACT: ${totalOffersToDelete} offers will be deleted.`);
    } else {
        console.log('✅ System is clean. No shared URLs found.');
    }
}

analyzeDuplicates();
