const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('scripts/yes24-ok-node.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- YES24 PAGE ANALYSIS ---');
console.log('Total a tags:', $('a').length);
console.log('Total img tags:', $('img').length);
console.log('Total div tags:', $('div').length);
console.log('Total li tags:', $('li').length);
console.log('Products (.goods_name a):', $('.goods_name a').length);
console.log('Products (.gd_name):', $('.gd_name').length);
console.log('Item Units (.itemUnit):', $('.itemUnit').length);
console.log('List Items (#yesSchList li):', $('#yesSchList li').length);

const allText = $('body').text().replace(/\s+/g, ' ');
console.log('\nText Contains "Sade"?', allText.toLowerCase().includes('sade'));
console.log('Text Contains "Price"?', allText.toLowerCase().includes('price'));
console.log('Text Contains "Stronger"?', allText.toLowerCase().includes('stronger'));

console.log('\nPage Title:', $('title').text());
