
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDomains() {
    console.log('🔍 Analyzing Offer Domains...');

    const { data: offers } = await supabase
        .from('lp_offers')
        .select('url');

    if (!offers) return;

    const domainCounts = new Map<string, number>();

    offers.forEach(o => {
        if (!o.url) return;
        try {
            const urlObj = new URL(o.url);
            const domain = urlObj.hostname.replace('www.', '');
            domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
        } catch (e) {
            // ignore invalid urls
        }
    });

    // Sort by count
    const sorted = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]);

    console.log('\n📊 Domain Distribution:');
    sorted.forEach(([domain, count]) => {
        console.log(`${domain}: ${count}`);
    });
}

analyzeDomains();
