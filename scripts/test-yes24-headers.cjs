const url = 'https://www.yes24.com/Product/Search?domain=ALL&query=5099746049713';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function checkRedirect() {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url, {
        redirect: 'manual',
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.yes24.com/',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Dest': 'document'
        }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`);
    response.headers.forEach((value, name) => {
        console.log(`  ${name}: ${value}`);
    });
}

checkRedirect();
