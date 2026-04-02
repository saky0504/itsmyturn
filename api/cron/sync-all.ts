
export default async function handler(req: Request) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Verify auth header
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error('Unauthorized cron execution attempt');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const results: Record<string, any> = {};
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

    console.log(`Starting unified cron sync at ${new Date().toISOString()}`);

    const runSync = async (name: string, path: string) => {
        try {
            console.log(`[sync-all] Starting ${name}...`);
            const response = await fetch(`${baseUrl}${path}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.CRON_SECRET}`
                }
            });

            const data = await response.json();
            results[name] = { status: response.status, data };
            console.log(`[sync-all] Finished ${name}:`, response.status);
        } catch (error: any) {
            console.error(`[sync-all] Error in ${name}:`, error);
            results[name] = { error: error.message };
        }
    };

    // Run them sequentially to avoid overwhelming the database or hitting connection limits
    await runSync('hourly-sync', '/api/hourly-sync');
    await runSync('sync-aladin', '/api/cron/sync-aladin');
    await runSync('sync-discogs', '/api/cron/sync-discogs');
    await runSync('sync-spotify', '/api/cron/sync-spotify');
    await runSync('sync-juno', '/api/cron/sync-juno');
    await runSync('sync-metacritic', '/api/cron/sync-metacritic');

    console.log(`Unified cron sync completed.`);

    return new Response(JSON.stringify({
        success: true,
        message: 'All sync jobs completed',
        results
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
