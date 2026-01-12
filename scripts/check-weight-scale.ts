import fetch from 'node-fetch';

async function checkWeightScaleURL() {
    const url = 'https://search.shopping.naver.com/catalog/56785400633';

    console.log(`🔍 Checking URL: ${url}\n`);

    const response = await fetch(url);
    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : 'Title not found';

    console.log(`Title: ${title}`);
    console.log(`\nContains "LP": ${title.toLowerCase().includes('lp')}`);
    console.log(`Contains "vinyl": ${title.toLowerCase().includes('vinyl')}`);
    console.log(`Contains "바이닐": ${title.includes('바이닐')}`);
    console.log(`Contains "Pink Floyd": ${title.includes('Pink Floyd')}`);
    console.log(`Contains "Wish You Were Here": ${title.includes('Wish You Were Here')}`);
}

checkWeightScaleURL().catch(console.error);
