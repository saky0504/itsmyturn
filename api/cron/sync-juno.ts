import * as cheerio from 'cheerio';
import { upsertProductMetadataSafe, delay } from '../../api-lib/db-ingest';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function GET(request: Request) {
    try {
        console.log('[Cron - Juno] Starting Coming Soon sync...');

        // Fetch Juno's Coming Soon page (Vinyl specifically, but their main coming soon has a lot of vinyl)
        const url = 'https://www.juno.co.uk/all/coming-soon/';
        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT }
        });

        if (!res.ok) {
            return new Response(JSON.stringify({ error: `Juno HTTP Error: ${res.status}` }), { status: 500 });
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        // Juno releases are usually grouped in div.juno-release
        const releases = $('.juno-release');
        let totalProcessed = 0;

        for (let i = 0; i < releases.length; i++) {
            const el = releases.eq(i);

            // Extract Artist and Title
            const artist = el.find('.juno-artist').text().trim();
            const title = el.find('.juno-title').text().trim();
            const formatStr = el.find('.juno-format').text().trim().toLowerCase();
            const cover = el.find('.img-link img').attr('src') || '';
            const description = el.find('.jq_release_text').text().trim();

            if (!artist || !title) continue;

            // Strict Filter: We only want LP / Vinyl formats, not DJ CDs or Digital
            if (!formatStr.includes('lp') && !formatStr.includes('vinyl') && !formatStr.includes('12"')) {
                continue;
            }

            console.log(`[Cron - Juno] Processing: ${artist} - ${title}`);

            await upsertProductMetadataSafe({
                artist: artist,
                title: title,
                cover: cover,
                format: 'Vinyl',
                description: description || 'Juno Records Coming Soon Preview'
            });

            totalProcessed++;

            // Wait 2-3s between processing each item to not overload DB & Discogs API
            await delay(2000);

            // Cap at 4 items per run to avoid Vercel Function Timeout (10s on Free Plan)
            if (totalProcessed >= 4) {
                console.log('[Cron - Juno] Reached maximum safe limit of 4 items for this cron run.');
                break;
            }
        }

        return new Response(JSON.stringify({ success: true, message: `Processed ${totalProcessed} new LPs from Juno` }), { status: 200 });

    } catch (e: any) {
        console.error('[Cron - Juno] Fatal Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
