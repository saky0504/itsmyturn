import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

async function fetchWithRetry(url: string, retries = 1): Promise<string> {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            return await response.text();
        } catch { }
    }
    return '';
}

async function testYes24() {
    console.log('\n--- YES24 ---');
    // A query for a notoriously sold out item or generic search
    const query = 'Justin Timberlake Futuresex LP';
    const url = `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(query)}`;

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    $('#yesSchList li').slice(0, 3).each((_, el) => {
        const item = $(el);
        const title = item.find('.gd_name').text().trim();
        const infoRaw = item.text();
        const outOfStockFlag = infoRaw.includes('품절') || infoRaw.includes('절판');
        const price = item.find('.yes_price, .price, .yes_b').first().text().trim();

        // Print raw text of specific state badges
        const badges = item.find('.icon_line, .icon_tag, .yes_tag').text().trim();

        console.log(`Title: ${title}`);
        console.log(`Price: ${price}`);
        console.log(`Badges/Tags: ${badges}`);
        console.log(`Raw Contains OutOfStock: ${outOfStockFlag}`);
        console.log('---');
    });
}

testYes24();
