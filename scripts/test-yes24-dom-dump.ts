import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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
    const query = 'Rubber Soul LP';
    const url = `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(query)}`;

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    $('#yesSchList li').slice(0, 3).each((_, el) => {
        const item = $(el);
        const title = item.find('.gd_name').text().trim();
        const price = item.find('.yes_price, .price, .yes_b').first().text().trim();
        const htmlDump = item.html() || '';

        console.log(`Title: ${title}`);
        console.log(`Price: ${price}`);
        console.log(`Contains 품절: ${htmlDump.includes('품절')}`);

        if (htmlDump.includes('품절')) {
            console.log("--- HTML DUMP START ---");
            console.log(htmlDump.substring(0, 2000)); // Print part of it to find the tag
            const lines = htmlDump.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('품절') || lines[i].includes('절판') || lines[i].includes('일시')) {
                    console.log(`Found string on line ${i}: ${lines[i].trim()}`);
                }
            }
            console.log("--- HTML DUMP END ---");
        }
    });
}

testYes24();
