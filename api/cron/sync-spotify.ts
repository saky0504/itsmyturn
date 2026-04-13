import { upsertProductMetadataSafe, delay } from '../../api-lib/db-ingest';

export async function GET(request: Request) {
    try {
        const CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID;
        const CLIENT_SECRET = process.env.VITE_SPOTIFY_CLIENT_SECRET || process.env.SPOTIFY_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
            return new Response(JSON.stringify({ error: 'Missing Spotify Credentials' }), { status: 500 });
        }

        console.log('[Cron - Spotify] Authenticating...');

        // 1. Get Spotify Access Token (Client Credentials Flow)
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')}`
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenResponse.ok) {
            return new Response(JSON.stringify({ error: 'Spotify Auth Failed' }), { status: 500 });
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        console.log('[Cron - Spotify] Fetching New Releases...');

        // 2. Fetch New Releases
        await delay(1000);
        const searchResponse = await fetch('https://api.spotify.com/v1/browse/new-releases?limit=10&country=US', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!searchResponse.ok) {
            return new Response(JSON.stringify({ error: 'Spotify API Failed' }), { status: 500 });
        }

        const data = await searchResponse.json();
        const albums = data.albums?.items || [];
        let totalProcessed = 0;

        for (const album of albums) {
            // Filter strictly for Album Types (ignore Singles unless desired, usually LPs are ALBUm)
            if (album.album_type !== 'album') continue;

            const artistName = album.artists[0]?.name || 'Unknown Artist';
            const title = album.name;
            const coverUrl = album.images && album.images.length > 0 ? album.images[0].url : '';

            console.log(`[Cron - Spotify] Processing: ${artistName} - ${title}`);

            await upsertProductMetadataSafe({
                artist: artistName,
                title: title,
                cover: coverUrl,
                format: 'Vinyl', // We assume major new album releases get vinyl pressings
                description: `Spotify New Release ID: ${album.id}`
            });

            totalProcessed++;

            // Limit to 4 to prevent Vercel 10s Serverless Timeout 
            // 4 records * ~2.0s DB/Discogs delay = ~8 seconds max
            if (totalProcessed >= 4) {
                console.log('[Cron - Spotify] Reached maximum safe limit of 4 items for this cron run.');
                break;
            }
        }

        return new Response(JSON.stringify({ success: true, message: `Processed ${totalProcessed} new Spotify Albums` }), { status: 200 });

    } catch (e: any) {
        console.error('[Cron - Spotify] Fatal Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
