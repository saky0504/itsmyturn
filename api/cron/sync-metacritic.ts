import * as cheerio from 'cheerio';
import { upsertProductMetadataSafe, delay } from '../../api-lib/db-ingest';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function GET(request: Request) {
    try {
        console.log('[Cron - Metacritic] Starting Upcoming Releases sync...');

        // Metacritic's upcoming albums URL
        const url = 'https://www.metacritic.com/browse/albums/release-date/coming-soon/date';
        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT }
        });

        if (!res.ok) {
            return new Response(JSON.stringify({ error: `Metacritic HTTP Error: ${res.status}` }), { status: 500 });
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        let totalProcessed = 0;

        // Metacritic class structures fluctuate, but product_title / product_artist are common
        // or c-title / c-subTitle in their modern redesign
        const items = $('.c-finderProductCard'); // Try modern design selector first

        if (items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const el = items.eq(i);

                // Usually "Artist - Title" or separate
                let title = el.find('.c-finderProductCard_title').text().trim();
                let artist = el.find('.c-finderProductCard_subTitle').text().trim();

                // Sometimes title has [EP] or similar, clean it
                title = title.replace(/\[.*?\]/g, '').trim();

                if (!artist || !title) continue;

                console.log(`[Cron - Metacritic] Processing: ${artist} - ${title}`);

                await upsertProductMetadataSafe({
                    artist: artist,
                    title: title,
                    format: 'Vinyl', // Assume major metacritic releases get vinyl
                    description: 'Metacritic Upcoming Release'
                });

                totalProcessed++;
                await delay(2000);

                if (totalProcessed >= 4) {
                    console.log('[Cron - Metacritic] Reached maximum limit of 4 items.');
                    break;
                }
            }
        } else {
            console.log('[Cron - Metacritic] Warning: CSS Selectors might have changed, no items found.');
        }

        return new Response(JSON.stringify({ success: true, message: `Processed ${totalProcessed} new LPs from Metacritic` }), { status: 200 });

    } catch (e: any) {
        console.error('[Cron - Metacritic] Fatal Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
