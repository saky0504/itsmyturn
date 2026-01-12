
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const buffer = await res.arrayBuffer();
        const decoder = new TextDecoder('euc-kr');
        return decoder.decode(buffer);
    } catch (e) {
        console.error(`Fetch error for ${url}:`, e);
        return null;
    }
}

async function inspect() {
    console.log('🔍 Finding Yes24 LP Category...');

    // 1. Check Main Music Page for LP Link
    const mainUrl = 'https://www.yes24.com/Mall/Main/Music/003';
    const mainHtml = await fetchHtml(mainUrl);

    let lpCategoryUrl = '';

    if (mainHtml) {
        const $ = cheerio.load(mainHtml);
        const links = $('a');

        links.each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (href && (text.includes('LP') || text.includes('Vinyl')) && href.includes('Category/Display')) {
                console.log(`FOUND LINK: [${text}] -> ${href}`);
                if (!lpCategoryUrl) lpCategoryUrl = href; // Take first one
            }
        });
    }

    if (!lpCategoryUrl) {
        console.log('⚠️ Could not find explicit LP link on main page. Using fallback.');
        lpCategoryUrl = '/24/Category/Display/003001030'; // Fallback
    }

    const fullUrl = lpCategoryUrl.startsWith('http') ? lpCategoryUrl : `https://www.yes24.com${lpCategoryUrl}`;
    console.log(`\n📂 Inspecting Category: ${fullUrl}`);

    const catHtml = await fetchHtml(fullUrl);
    if (!catHtml) return;

    const $cat = cheerio.load(catHtml);
    console.log(`   Title: ${$cat('title').text()}`);

    // Check "New" Tab/Link on this page
    // Often there is a "New Arrivals" (신상품) link
    const newLink = $cat('a:contains("신상품")').attr('href');
    console.log(`   'New' Link: ${newLink}`);

    // Or check product list directly
    const products = $('.goods_list .goods_info, .cCont_goodsSet .goods_info');
    console.log(`   Found ${products.length} products on category page.`);

    if (products.length > 0) {
        const first = products.first();
        const title = first.find('.goods_name a').text().trim();
        const link = first.find('.goods_name a').attr('href');
        console.log(`   Sample: ${title}`);
        console.log(`   Link: ${link}`);

        if (link) {
            const productFullUrl = link.startsWith('http') ? link : `https://www.yes24.com${link}`;
            console.log(`   Fetching Detail: ${productFullUrl}`);
            const detailHtml = await fetchHtml(productFullUrl);
            if (detailHtml) {
                const $$ = cheerio.load(detailHtml);
                // Extract EAN
                // Usually in table #infoset_specific
                const tableText = $$('.gd_infoLi').text() + $$('.infoSetCont_wrap').text();
                // Find 13 digit number starting with 880 or 978 etc.
                const eanMatch = tableText.match(/\d{13}/);
                if (eanMatch) {
                    console.log(`   ✅ Extracted EAN: ${eanMatch[0]}`);
                } else {
                    console.log(`   ❌ Could not extract EAN. Text snippet: ${tableText.substring(0, 100)}...`);
                }
            }
        }
    }
}

inspect();
