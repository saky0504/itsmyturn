import { createClient } from '@supabase/supabase-js';

type LpProductRow = any;
type LpProductInsert = any;

// Construct Admin DB Client to bypass RLS rules safely on the backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchDiscogsMetadata(artist: string, title: string) {
    const DISCOGS_TOKEN = process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN || process.env.VITE_DISCOGS_PAT;
    if (!DISCOGS_TOKEN) return null;

    // Search Discogs API
    // Ensure we respect Discogs Rate Limits (60 requests per minute)
    await delay(1500);

    try {
        const query = encodeURIComponent(`${artist} ${title}`);
        const url = `https://api.discogs.com/database/search?q=${query}&format=Vinyl&type=master&token=${DISCOGS_TOKEN}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'ItsMyTurnApp/1.0' } });

        if (!res.ok) {
            if (res.status === 429) {
                console.warn('[Discogs] Rate limited. Waiting 10s...');
                await delay(10000); // Backoff
            }
            return null;
        }

        const data = await res.json();
        if (!data.results || data.results.length === 0) return null;

        const bestMatch = data.results[0];

        // Fetch Master Release details for genres/styles
        await delay(1500);
        const masterRes = await fetch(bestMatch.resource_url, {
            headers: {
                'User-Agent': 'ItsMyTurnApp/1.0',
                'Authorization': `Discogs token=${DISCOGS_TOKEN}`
            }
        });

        if (!masterRes.ok) return { bestMatch, details: null };

        const masterData = await masterRes.json();
        return { bestMatch, details: masterData };

    } catch (err) {
        console.error('[Discogs Fetch Error]', err);
        return null;
    }
}

function normalizeStr(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

/**
 * Ensures the product is deduplicated, fetches Discogs data if new, and writes to Supabase.
 * Enforces a strict processing delay per item to avoid database or API throttling.
 */
export async function upsertProductMetadataSafe(scrapedData: {
    artist: string;
    title: string;
    cover?: string;
    barcode?: string;
    format?: string;
    description?: string;
}) {
    // 1. Mandatory base throttling (Protect our own DB & downstream APIs)
    await delay(2000);

    if (!scrapedData.artist || !scrapedData.title) return;

    // Normalize for fuzzy DB comparison
    const normScrapedArtist = normalizeStr(scrapedData.artist);
    const normScrapedTitle = normalizeStr(scrapedData.title);
    const cleanBarcode = scrapedData.barcode?.replace(/[^0-9]/g, '');

    // 2. Pre-Check existing rows in DB
    let existingRow: LpProductRow | null = null;

    if (cleanBarcode) {
        const { data } = await supabaseAdmin.from('lp_products').select('*').eq('ean', cleanBarcode).limit(1).single();
        if (data) existingRow = data;
    }

    if (!existingRow) {
        // Fallback: search by artist & title text matching (Fuzzy logic)
        // Since Supabase doesn't easily do client-side fuzzy text replace in SQL easily, 
        // we'll fetch potentials or just heavily rely on generic ilike.
        // For strictness, a generic `ilike` is safest.
        const { data: potentials } = await supabaseAdmin.from('lp_products')
            .select('*')
            .ilike('artist', `%${scrapedData.artist.substring(0, 5)}%`)
            .ilike('title', `%${scrapedData.title.substring(0, 5)}%`)
            .limit(10);

        if (potentials) {
            existingRow = potentials.find(p =>
                normalizeStr(p.artist || '') === normScrapedArtist &&
                normalizeStr(p.title || '') === normScrapedTitle
            ) || null;
        }
    }

    if (existingRow) {
        // 3a. DUPLICATE FOUND: Only Fill-In-The-Blanks (Patch)
        const updates: any = {};
        if (!existingRow.ean && cleanBarcode) updates.ean = cleanBarcode;
        if (!existingRow.cover && scrapedData.cover) updates.cover = scrapedData.cover;
        if (!existingRow.description && scrapedData.description) updates.description = scrapedData.description;

        if (Object.keys(updates).length > 0) {
            console.log(`[DB Ingest] Patching existing item: ${existingRow.title}`);
            const res = await supabaseAdmin.from('lp_products').update(updates).eq('id', existingRow.id);
            if (res.error) console.error(`[DB Ingest] Patch failed:`, res.error.message);
        } else {
            console.log(`[DB Ingest] Item already exists and is complete: ${existingRow.title}`);
        }
        return;
    }

    // 3b. NEW RELEASE: Priority Discogs Fetch
    console.log(`[DB Ingest] New Item Detected: ${scrapedData.artist} - ${scrapedData.title}. Checking Discogs...`);
    const discogsData = await fetchDiscogsMetadata(scrapedData.artist, scrapedData.title);

    let finalInsert: LpProductInsert;

    if (discogsData) {
        console.log(`[DB Ingest] Discogs Match Found! Using official metadata.`);
        const { bestMatch, details } = discogsData;
        finalInsert = {
            title: scrapedData.title, // Keep scraped as base or overwrite? Usually Discogs title has exact formatting.
            artist: scrapedData.artist,
            cover: bestMatch.cover_image || scrapedData.cover || '',
            discogs_id: bestMatch.id.toString(),
            format: 'Vinyl',
            ean: cleanBarcode || null,
            genres: details?.genres || bestMatch.genre || ['Pop'],
            styles: details?.styles || bestMatch.style || [],
            release_date: bestMatch.year || details?.year || null,
            description: scrapedData.description || null,
        };
    } else {
        console.log(`[DB Ingest] No Discogs match. Falling back to scraped baseline data.`);
        finalInsert = {
            title: scrapedData.title,
            artist: scrapedData.artist,
            cover: scrapedData.cover || '',
            format: scrapedData.format || 'Vinyl',
            ean: cleanBarcode || null,
            description: scrapedData.description || null,
            genres: ['Unknown'],
        };
    }

    // Insert to DB
    const { error } = await supabaseAdmin.from('lp_products').insert(finalInsert);
    if (error) {
        console.error(`[DB Ingest] Insert failed for ${scrapedData.title}:`, error.message);
    } else {
        console.log(`[DB Ingest] Inserted new album: ${scrapedData.title}`);
    }
}
