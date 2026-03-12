import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchWithRetry(url: string, retries = 1): Promise<string> {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9',
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (e) {
            if (i === retries) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return '';
}

async function testKyobo() {
    console.log('\n--- KYOBO ---');
    // A query that might have mixed states
    const query = 'Justin Timberlake Futuresex LP';
    const url = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(query)}&gbCode=TOT&target=total`;
    console.log(`URL: ${url}`);

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    $('.prod_item').slice(0, 5).each((_, el) => {
        const item = $(el);
        const titleSpan = item.find('a.prod_info span[id^="cmdtName"]');
        const title = titleSpan.length ? titleSpan.text().trim() : item.find('.prod_info').text().replace(/\s+/g, ' ').trim();
        const priceText = item.find('.price .val').text();

        // Find stock status in Kyobo
        // Often Kyobo has a span or div indicating "품절" or "절판"
        const badgeList = item.find('.badge_list .badge_inner span, .badge_sm span').map((_, b) => $(b).text().trim()).get();
        const infoRaw = item.find('.prod_info').text();
        const outOfStockFlag = infoRaw.includes('품절') || infoRaw.includes('절판');

        console.log(`Title: ${title}`);
        console.log(`Price: ${priceText}`);
        console.log(`Badges: ${badgeList.join(', ')}`);
        console.log(`Raw Contains OutOfStock: ${outOfStockFlag}`);
        console.log('---');
    });
}

testKyobo();
