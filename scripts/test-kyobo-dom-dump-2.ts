import * as cheerio from 'cheerio';

async function testKyobo() {
    const query = 'Rubber Soul LP';
    const url = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(query)}&gbCode=TOT&target=total`;
    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const html = await response.text();
    const $ = cheerio.load(html);

    $('.prod_item').slice(0, 3).each((_, el) => {
        const item = $(el);
        const titleSpan = item.find('a.prod_info span[id^="cmdtName"]');
        const title = titleSpan.length ? titleSpan.text().trim() : item.find('.prod_info').text().replace(/\s+/g, ' ').trim();
        const price = item.find('.price .val').text().trim();
        const htmlDump = item.text();

        console.log(`Title: ${title}`);
        console.log(`Price: ${price}`);
        console.log(`Contains 품절: ${htmlDump.includes('품절')}`);

        if (htmlDump.includes('품절')) {
            console.log("--- FOUND '품절' IN THESE TAGS ---");
            item.find('*').each((_, child) => {
                const text = $(child).text();
                if (text.includes('품절') && $(child).children().length === 0) {
                    console.log(`Tag: <${child.tagName} class="${$(child).attr('class') || ''}"> - Text: ${text.trim()}`);
                }
            });
        }
    });
}
testKyobo();
