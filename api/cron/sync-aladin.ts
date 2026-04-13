import { upsertProductMetadataSafe, delay } from '../../api-lib/db-ingest';

export async function GET(request: Request) {
    try {
        const TTB_KEY = process.env.VITE_ALADIN_TTB_KEY || process.env.ALADIN_TTB_KEY;
        if (!TTB_KEY) {
            return new Response(JSON.stringify({ error: 'Missing Aladin TTB Key' }), { status: 500 });
        }

        console.log('[Cron - Aladin] Starting sync...');

        // We will fetch two lists: ItemNewAll (Brand new items) and ItemNewSpecial (Special/Bestselling new items)
        const queryTypes = ['ItemNewAll', 'ItemNewSpecial'];
        let totalProcessed = 0;

        for (const qType of queryTypes) {
            console.log(`[Cron - Aladin] Fetching ${qType}...`);
            const url = `http://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${TTB_KEY}&QueryType=${qType}&MaxResults=50&start=1&SearchTarget=Music&output=js&Version=20131101`;

            const res = await fetch(url);
            if (!res.ok) {
                console.error(`[Cron - Aladin] HTTP Error: ${res.status}`);
                continue;
            }

            const data = await res.json();
            if (!data || !data.item) continue;

            const items = data.item;
            for (const item of items) {
                // Filter strictly for LP/Vinyl
                const titleLower = item.title.toLowerCase();
                const categoryLower = (item.categoryName || '').toLowerCase();
                const descriptionLower = (item.description || '').toLowerCase();

                const isVinyl = titleLower.includes('lp') ||
                    titleLower.includes('vinyl') ||
                    categoryLower.includes('lp') ||
                    categoryLower.includes('vinyl');

                const isCD = titleLower.includes('cd') ||
                    titleLower.includes('dvd') ||
                    titleLower.includes('blu-ray');

                if (isVinyl && !isCD) {
                    // Clean up title (Aladin titles often have [- LP] or features appended)
                    const cleanTitle = item.title.replace(/\[.*?(LP|lp|Vinyl|vinyl).*?\]/g, '').trim();
                    const cleanArtist = item.author ? item.author.split(',')[0].trim() : 'Unknown Artist';

                    console.log(`[Cron - Aladin] Processing: ${cleanArtist} - ${cleanTitle}`);

                    await upsertProductMetadataSafe({
                        artist: cleanArtist,
                        title: cleanTitle,
                        cover: item.cover,
                        barcode: item.isbn13 || item.isbn,
                        format: 'Vinyl',
                        description: item.description
                    });

                    totalProcessed++;

                    // Vercel cron max duration limit on free tier is 10s-15s. 
                    // If we want to process more securely, we must stop early.
                    if (totalProcessed >= 5) {
                        console.log('[Cron - Aladin] Reached 5 items max threshold for this cron run. Pausing until next run to avoid timeouts.');
                        return new Response(JSON.stringify({ success: true, message: `Processed ${totalProcessed} new LPs`, stoppedEarly: true }), { status: 200 });
                    }
                }
            }

            // Wait 2 seconds before requesting the next list type
            await delay(2000);
        }

        return new Response(JSON.stringify({ success: true, message: `Processed ${totalProcessed} new LPs` }), { status: 200 });
    } catch (e: any) {
        console.error('[Cron - Aladin] Fatal Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
