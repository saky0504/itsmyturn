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

async function testKyobo() {
    console.log('\n--- KYOBO RAW HTML ---');
    const query = 'Justin Timberlake Futuresex LP';
    const url = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(query)}&gbCode=TOT&target=total`;

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    $('.prod_item').slice(0, 1).each((_, el) => {
        console.log($(el).html());
    });
}

testKyobo();
