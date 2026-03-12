import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function searchNaver(query: string) {
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

    console.log(`\nDirect Naver Search For: ${query}`);
    const res = await fetch(`https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=20`, {
        headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID!, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET! }
    });

    const data = await res.json();
    if (data.items) {
        data.items.forEach((item: any) => {
            const rawTitle = item.title.replace(/<[^>]*>?/gm, ''); // Strip HTML tags like <b>
            console.log(`[NAVER RAW] ${rawTitle}`);
        });
    }
}

async function run() {
    await searchNaver('Justin Timberlake Futuresex / Lovesounds LP 바이닐');
    await searchNaver('Gorillaz Gorillaz LP 바이닐');
}

run();
