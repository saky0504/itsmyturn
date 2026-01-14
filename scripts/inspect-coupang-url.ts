
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCoupang() {
    const targetUrl = 'https://link.coupang.com/re/PCSNAVERPCSDP?pageKey=9299716925&ctag=9299716925&lptag=P9299716925&itemId=27548250286&vendorItemId=94512558017&spec=10305199';
    console.log(`🔍 Inspecting Coupang Link...`);

    // 1. Check DB
    const { data: offers } = await supabase
        .from('lp_offers')
        .select('id, product_id, lp_products(title, artist)')
        .like('url', '%9299716925%'); // Search by pageKey

    if (offers && offers.length > 0) {
        console.log(`⚠️ Found in DB! Linked to ${offers.length} products:`);
        offers.forEach(o => console.log(`   - Product: [${(o.lp_products as any)?.artist} - ${(o.lp_products as any)?.title}]`));
    } else {
        console.log('✅ Not found in DB (Clean).');
    }

    // 2. Fetch Metadata (if possible, Coupang might block bots)
    console.log('   Attempting to fetch page title...');
    try {
        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const title = $('title').text().trim();
        console.log(`   Page Title: ${title}`);
    } catch (e) {
        console.log('   Failed to fetch page (Coupang anti-bot likely active).');
    }
}

inspectCoupang();
