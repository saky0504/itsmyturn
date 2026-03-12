const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('scripts/kyobo-keyword.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- KYOBO PAGE ANALYSIS ---');
console.log('Total a tags:', $('a').length);
console.log('Total img tags:', $('img').length);
console.log('Products (.prod_item):', $('.prod_item').length);
console.log('Products (.prod_info):', $('.prod_info').length);
console.log('Products (.prod_name):', $('.prod_name').length);
console.log('Products (.price):', $('.price').length);
console.log('\n--- EXTRACTING ITEMS ---');
$('.prod_item').each((i, el) => {
    const item = $(el);
    const title = item.find('a.prod_info span[id^="cmdtName"]').text().trim() || item.find('.prod_info').text().replace(/\s+/g, ' ').trim();
    const link = item.find('a.prod_info').attr('href');
    const priceText = item.find('.price .val').text().trim();
    console.log(`\nItem ${i}:`);
    console.log(`Title: ${title}`);
    console.log(`Link: ${link}`);
    console.log(`Price: ${priceText}`);
});
