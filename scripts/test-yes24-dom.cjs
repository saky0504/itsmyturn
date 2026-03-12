const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('scripts/yes24-ok-node.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- YES24 ITEM EXTRACTION SUMMARY ---');
$('.itemUnit').slice(0, 5).each((i, el) => {
    const item = $(el);
    const title = item.find('a.gd_name').text().trim() || item.find('.gd_name').text().trim() || item.find('.goods_name a').first().text().trim();
    const link = item.find('a').first().attr('href');
    const priceText = item.find('.yes_price, .price, .yes_b').first().text();
    console.log(`\nItem ${i}:`);
    console.log(`Title: ${title}`);
    console.log(`Link: ${link}`);
    console.log(`Price Text: ${priceText}`);
});
