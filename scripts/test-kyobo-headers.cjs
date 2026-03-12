const fs = require('fs');
const urlKeyword = 'https://search.kyobobook.co.kr/search?keyword=Sade%20Stronger%20Than%20Pride%20LP&gbCode=TOT&target=total';
const urlEan = 'https://search.kyobobook.co.kr/search?keyword=5099746049713&gbCode=TOT&target=total';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function testKyobo(url, name) {
    console.log(`\nTesting Kyobo ${name}: ${url}`);
    const response = await fetch(url, {
        redirect: 'manual',
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html',
            'Accept-Language': 'ko-KR,ko;q=0.9',
        }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const html = await response.text();
    console.log(`HTML Length: ${html.length}`);
    fs.writeFileSync(`scripts/kyobo-${name}.html`, html, 'utf8');
}

async function run() {
    await testKyobo(urlEan, 'ean');
    await testKyobo(urlKeyword, 'keyword');
}

run();
