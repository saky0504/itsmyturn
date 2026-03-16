import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN;
const USER_AGENT = process.env.DISCOGS_USER_AGENT || 'itsmyturn/1.0';
const MAX_PER_RUN = 3; // Vercel 10s 제한 고려

function discogsHeaders() {
    const h: Record<string, string> = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
    };
    if (DISCOGS_TOKEN) h['Authorization'] = `Discogs token=${DISCOGS_TOKEN}`;
    return h;
}

function detectTracklistLanguage(tracks: { title: string }[]): 'ko' | 'en' | 'other' {
    const titles = tracks.map(t => t.title).join(' ');
    if (/[가-힣]/.test(titles)) return 'ko';
    if (/^[a-zA-Z0-9\s\.,\-'()\:\!\?&\/]+$/.test(titles)) return 'en';
    return 'other';
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!DISCOGS_TOKEN) {
        return new Response(JSON.stringify({ error: 'Missing DISCOGS_TOKEN' }), { status: 500 });
    }

    try {
        console.log('[Cron - Discogs] Starting sync...');

        // 한국 LP 검색 (장르: K-Pop, 국가: South Korea)
        const searchStrategies = [
            `https://api.discogs.com/database/search?type=release&format=LP&country=South+Korea&per_page=20&page=${Math.floor(Math.random() * 5) + 1}&sort=year&sort_order=desc`,
            `https://api.discogs.com/database/search?type=release&format=LP&genre=Pop&style=K-Pop&per_page=20&page=${Math.floor(Math.random() * 5) + 1}`,
        ];

        const searchUrl = searchStrategies[Math.floor(Math.random() * searchStrategies.length)];
        const searchRes = await fetch(searchUrl, { headers: discogsHeaders() });
        if (!searchRes.ok) {
            return new Response(JSON.stringify({ error: `Discogs search failed: ${searchRes.status}` }), { status: 500 });
        }

        const searchData = await searchRes.json();
        const results = searchData.results || [];

        let added = 0;
        for (const result of results) {
            if (added >= MAX_PER_RUN) break;

            const discogsId = String(result.id);

            // 중복 체크
            const { data: existing } = await supabase
                .from('lp_products')
                .select('id')
                .eq('discogs_id', discogsId)
                .maybeSingle();

            if (existing) continue;

            // 상세 정보 가져오기
            const detailRes = await fetch(`https://api.discogs.com/releases/${discogsId}`, { headers: discogsHeaders() });
            if (!detailRes.ok) continue;

            const detail = await detailRes.json();

            // 아티스트 정리
            const artist = (detail.artists || []).map((a: { name: string }) => a.name.replace(/\s*\(\d+\)\s*$/, '')).join(', ') || 'Unknown Artist';
            const title = detail.title || result.title?.split(' - ').slice(1).join(' - ') || result.title;
            const tracklist = detail.tracklist || [];

            // 트랙리스트 언어 우선순위: ko > en > other
            const lang = detectTracklistLanguage(tracklist);
            console.log(`[Cron - Discogs] ${artist} - ${title} (lang: ${lang})`);

            // 이미 같은 아티스트+타이틀이 있는지 확인 (중복 방지)
            const { data: dupCheck } = await supabase
                .from('lp_products')
                .select('id, discogs_id')
                .ilike('title', title)
                .ilike('artist', artist)
                .limit(1)
                .maybeSingle();

            if (dupCheck) {
                // 더 좋은 버전이면 tracklist 업데이트
                const existingLang = dupCheck.discogs_id?.startsWith('aladin-') ? 'other' : 'en';
                const priority = { 'ko': 2, 'en': 1, 'other': 0 };
                if (priority[lang] > priority[existingLang]) {
                    await supabase.from('lp_products')
                        .update({ track_list: tracklist, discogs_id: discogsId })
                        .eq('id', dupCheck.id);
                    console.log(`[Cron - Discogs] Updated tracklist for: ${title}`);
                }
                continue;
            }

            // 바코드
            const barcode = detail.identifiers?.find((i: { type: string }) => i.type === 'Barcode')?.value || null;

            const { error } = await supabase.from('lp_products').insert({
                title,
                artist,
                cover: detail.images?.[0]?.uri150 || detail.thumb || null,
                format: 'LP',
                discogs_id: discogsId,
                ean: barcode || null,
                description: detail.notes || '',
                genres: detail.genres || [],
                styles: detail.styles || [],
                track_list: tracklist,
                release_date: detail.released || null,
                last_synced_at: new Date().toISOString(),
            });

            if (!error) {
                console.log(`[Cron - Discogs] ✅ Added: ${artist} - ${title}`);
                added++;
            }

            // Rate limit 방지
            await new Promise(r => setTimeout(r, 1500));
        }

        return new Response(JSON.stringify({ success: true, added }), { status: 200 });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[Cron - Discogs] Fatal Error:', msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
}
