const fs = require('fs');

async function dump() {
    const url = 'https://www.yes24.com/Product/Search?domain=ALL&query=Sade%20Stronger%20Than%20Pride%20LP';
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await response.text();
    fs.writeFileSync('scripts/yes24-ok-node.html', html, 'utf8');
}
dump();
