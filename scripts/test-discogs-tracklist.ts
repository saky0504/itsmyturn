import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function testDiscogsTracklist() {
    const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
    if (!DISCOGS_TOKEN) {
        console.error("No token");
        return;
    }

    // Known release: Rubber Soul
    const masterId = 24047; // Master release or we can test a release ID

    const headers = {
        'User-Agent': 'ItsMyTurnBot/1.0',
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    };

    try {
        const res = await fetch(`https://api.discogs.com/masters/${masterId}`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        console.log(`Successfully fetched: ${data.title} by ${data.artists?.[0]?.name}`);

        if (data.tracklist && Array.isArray(data.tracklist)) {
            console.log(`Found ${data.tracklist.length} tracks.`);
            const formattedTracks = data.tracklist.map((t: any) => ({
                position: t.position || '',
                title: t.title || '',
                duration: t.duration || ''
            }));
            console.log(JSON.stringify(formattedTracks.slice(0, 5), null, 2));
        } else {
            console.log("No tracklist found in this payload.");
        }
    } catch (error) {
        console.error("Error fetching discogs:", error);
    }
}

testDiscogsTracklist();
