import * as cheerio from 'cheerio';

async function testYes24() {
    const query = 'Rubber Soul LP';
    const url = `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(query)}`;
    const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('#yesSchList li').slice(0, 3).each((_, el) => {
        const item = $(el);
        const title = item.find('.gd_name').text().trim();
        const price = item.find('.yes_price, .price, .yes_b').first().text().trim();
        const htmlDump = item.text();

        console.log(`Title: ${title}`);
        console.log(`Price: ${price}`);
        console.log(`Contains 품절: ${htmlDump.includes('품절')}`);

        if (htmlDump.includes('품절')) {
            console.log("--- FOUND '품절' IN THESE TAGS ---");
            item.find('*').each((_, child) => {
                const text = $(child).text();
                // look for the narrowest element containing the text
                if (text.includes('품절') && $(child).children().length === 0) {
                    console.log(`Tag: <${child.tagName} class="${$(child).attr('class') || ''}"> - Text: ${text.trim()}`);
                }
            });
        }
    });
}
testYes24();
