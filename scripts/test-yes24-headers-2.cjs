const url = 'https://www.yes24.com/Product/Search?domain=ALL&query=Sade%20Stronger%20Than%20Pride%20LP';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function testHeaders() {
    const defaultHeaders = { 'User-Agent': USER_AGENT };
    console.log("Testing just User-Agent:", (await fetch(url, { redirect: 'manual', headers: defaultHeaders })).status);

    console.log("Testing with Accept:", (await fetch(url, { redirect: 'manual', headers: { ...defaultHeaders, 'Accept': 'text/html' } })).status);

    console.log("Testing with Sec-Ch-Ua:", (await fetch(url, { redirect: 'manual', headers: { ...defaultHeaders, 'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' } })).status);

    console.log("Testing with all production headers:", (await fetch(url, {
        redirect: 'manual', headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    })).status);
}

testHeaders();
