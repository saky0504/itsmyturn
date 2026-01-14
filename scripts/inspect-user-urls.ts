
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import * as cheerio from 'cheerio';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

const targets = [
    'https://product.kyobobook.co.kr/detail/S000218969321',
    'https://product.kyobobook.co.kr/detail/S000001802244',
    'https://product.kyobobook.co.kr/detail/S000218300273'
];

async function inspect() {
    console.log('🔍 Inspecting User Reported URLs...');

    for (const url of targets) {
        console.log(`\nTARGET: ${url}`);

        // 1. Check DB
        const { data: offers } = await supabase
            .from('lp_offers')
            .select('product_id, lp_products(title)')
            .eq('url', url);

        if (offers && offers.length > 0) {
            console.log(`⚠️  Still in DB! Linked to ${offers.length} products:`);
            offers.forEach(o => console.log(`   - [${(o.lp_products as any)?.title}]`));
        } else {
            console.log('✅ Not found in DB (Already cleaned up).');
        }

        // 2. Fetch Page Title
        try {
            const res = await fetch(url);
            const html = await res.text();
            const $ = cheerio.load(html);
            const title = $('title').text().trim();
            const productTitle = $('.prod_title_box .prod_title').text().trim() || 'Unknown Title';
            const category = $('.breadcrumb_list .breadcrumb_item').last().text().trim() || 'Unknown Category';
            const price = $('.prod_price_box .price .val').first().text().trim();

            console.log(`   Page Title: ${title}`);
            console.log(`   Product Name: ${productTitle}`);
            console.log(`   Category: ${category}`);
            console.log(`   Price: ${price}원`);
        } catch (e) {
            console.log('   Failed to fetch page metadata.');
        }
    }
}

inspect();
