
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupBlockedDomains() {
    console.log('🧹 Cleanup Blocked Domains Started...');

    // Exact same whitelist as sync-lp-data.ts
    const allowedDomains = [
        'smartstore.naver.com',
        'brand.naver.com',
        'shopping.naver.com',
        'www.yes24.com',
        'www.aladin.co.kr',
        'www.synnara.co.kr',
        'hottracks.kyobobook.co.kr',
        'book.interpark.com',
        'shopping.interpark.com',
        // 'link.coupang.com', // Optional: Keep Coupang? User seems to hate generic malls, but Coupang might be valid. Keeping for now if it's not spammy.
        // Actually, let's keep it strict based on previous analysis.
        // If domain is NOT in this list (or simple variations), we FLAG it.
    ];

    console.log('Allowed Whitelist:', allowedDomains);

    const { data: offers } = await supabase
        .from('lp_offers')
        .select('id, url');

    if (!offers) return;

    const toDelete: string[] = [];

    offers.forEach(o => {
        if (!o.url) return;
        try {
            const hostname = new URL(o.url).hostname;
            const isAllowed = allowedDomains.some(d => hostname.includes(d));

            // Special exceptions (e.g. mobile/desktop variations)
            // 'm.yes24.com' shouldn't be deleted if 'www.yes24.com' is allowed, but cleaner to rely on strict list.

            if (!isAllowed) {
                // Double check known good vendors that might have different subdomains
                const isKnownGood =
                    hostname.includes('yes24') ||
                    hostname.includes('aladin') ||
                    hostname.includes('interpark') ||
                    hostname.includes('kyobobook') ||
                    hostname.includes('coupang'); // Let's spare Coupang/others for a moment unless explicitly bad

                if (!isKnownGood) {
                    console.log(`❌ Flagged for deletion: ${hostname} (URL: ${o.url.substring(0, 50)}...)`);
                    toDelete.push(o.id);
                }
            }
        } catch (e) {
            console.log('❌ Flagged invalid URL:', o.url);
            toDelete.push(o.id);
        }
    });

    console.log(`\nFound ${toDelete.length} offers from blocked/unknown domains.`);

    if (toDelete.length > 0) {
        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error } = await supabase.from('lp_offers').delete().in('id', batch);
            if (error) console.error('Delete error', error);
            else console.log(`Deleted batch ${i / batchSize + 1}`);
        }
        console.log('✅ Cleanup Complete.');
    } else {
        console.log('✅ No blocked domain offers found.');
    }
}

cleanupBlockedDomains();
