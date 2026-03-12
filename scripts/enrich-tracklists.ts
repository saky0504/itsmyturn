import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase env vars.");
    process.exit(1);
}

if (!DISCOGS_TOKEN) {
    console.error("Missing Discogs token.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    console.log('Fetching products lacking tracklists...');

    // Get products that don't have a track_list or track_list is an empty array/null
    // In Supabase JSONB, we can check if it's null or '[]'
    // But maybe it's safest to fetch all and filter locally if there's only a few hundred.
    const { data: products, error } = await supabase
        .from('lp_products')
        .select('id, title, artist, discogs_id, track_list');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    const targets = products.filter(p => !p.track_list || p.track_list.length === 0);
    console.log(`Found ${targets.length} products needing a tracklist (out of ${products.length} total).`);

    const headers = {
        'User-Agent': 'ItsMyTurnBot/1.0',
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    };

    let updatedCount = 0;

    for (const product of targets) {
        let discogsId = product.discogs_id;
        let url = '';

        // First, try to use discogs_id as a Master ID if it exists.
        // If not, we fall back to a Search query.
        if (!discogsId) {
            console.log(`[${product.title}] No Discogs ID, searching...`);
            const searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(product.artist + ' ' + product.title)}&type=master`;
            try {
                const res = await fetch(searchUrl, { headers });
                if (res.ok) {
                    const searchData = await res.json();
                    if (searchData.results && searchData.results.length > 0) {
                        discogsId = searchData.results[0].id; // Assign first master id
                    }
                }
            } catch (e) { }
            await delay(1500); // Wait after search
        }

        if (!discogsId) {
            console.log(`[${product.title}] Skipping, could not find a Discogs ID.`);
            continue;
        }

        // Usually IDs we saved are Master IDs, let's try master first.
        let releaseUrl = `https://api.discogs.com/masters/${discogsId}`;
        let tracklistData = null;

        try {
            let res = await fetch(releaseUrl, { headers });
            if (res.status === 404) {
                // If 404, maybe it's a Release ID instead
                releaseUrl = `https://api.discogs.com/releases/${discogsId}`;
                await delay(500); // slight delay before retry
                res = await fetch(releaseUrl, { headers });
            }

            if (res.ok) {
                const releaseJson = await res.json();
                tracklistData = releaseJson.tracklist;
            }
        } catch (e) {
            console.log(`[${product.title}] Failed to fetch from Discogs.`);
        }

        if (tracklistData && Array.isArray(tracklistData)) {
            const formattedTracks = tracklistData.map((t: any) => ({
                position: t.position || '',
                title: t.title || '',
                duration: t.duration || ''
            }));

            const { error: updateError } = await supabase
                .from('lp_products')
                .update({ track_list: formattedTracks })
                .eq('id', product.id);

            if (!updateError) {
                console.log(`✅ [${product.title}] Updated ${formattedTracks.length} tracks.`);
                updatedCount++;
            } else {
                console.log(`❌ [${product.title}] DB update failed.`, updateError);
            }
        } else {
            console.log(`⚠️ [${product.title}] No tracklist found in Discogs payload.`);
        }

        // Rate limiting delay
        await delay(1500);
    }

    console.log(`\nFinished! Successfully updated ${updatedCount} albums.`);
}

run();
