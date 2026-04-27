/**
 * Discogs에서 한국 음악 LP 20개 가져오기 (중복 제외)
 * styles: K-Pop, Ballad, Korean Traditional, Trot + country=South Korea
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN!;

const TARGET = 20;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const headers = {
  'User-Agent': 'itsmyturn/1.0',
  'Accept': 'application/json',
  'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
};

// 검색 전략: 다양한 한국 음악 스타일 + country
const SEARCH_QUERIES = [
  'type=release&format=LP&style=K-Pop&country=South+Korea&sort=want&sort_order=desc',
  'type=release&format=LP&style=Ballad&country=South+Korea&sort=want&sort_order=desc',
  'type=release&format=LP&style=Korean+Traditional&sort=want&sort_order=desc',
  'type=release&format=LP&style=Trot&country=South+Korea&sort=want&sort_order=desc',
  'type=release&format=LP&country=South+Korea&sort=want&sort_order=desc',
];

async function run() {
  // DB에 있는 discogs_id 목록 수집
  const { data: existing } = await supabase
    .from('lp_products')
    .select('discogs_id')
    .not('discogs_id', 'is', null);

  const existingIds = new Set((existing || []).map((r: any) => String(r.discogs_id)));
  console.log(`DB 기존 상품: ${existingIds.size}개`);

  let inserted = 0;
  const seenIds = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    if (inserted >= TARGET) break;

    for (let page = 1; page <= 5 && inserted < TARGET; page++) {
      const url = `https://api.discogs.com/database/search?${query}&per_page=50&page=${page}`;
      console.log(`\n🔍 ${url}`);

      await sleep(1200);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn(`  ⚠️ ${res.status} - 스킵`);
        break;
      }
      const data = await res.json();
      const results: any[] = data.results || [];
      if (results.length === 0) break;

      console.log(`  ${results.length}개 결과, 신규 필터링 중...`);

      for (const item of results) {
        if (inserted >= TARGET) break;
        const id = String(item.id);
        if (existingIds.has(id) || seenIds.has(id)) continue;
        seenIds.add(id);

        // 상세 정보 fetch
        await sleep(1200);
        const detailRes = await fetch(`https://api.discogs.com/releases/${id}`, { headers });
        if (!detailRes.ok) {
          if (detailRes.status === 429) { await sleep(30000); }
          continue;
        }
        const d = await detailRes.json();

        const artist = (d.artists || [])
          .map((a: any) => a.name.replace(/\s*\(\d+\)\s*$/, ''))
          .join(', ') || item.title?.split(' - ')[0] || 'Unknown';
        const title = d.title || item.title?.split(' - ').slice(1).join(' - ') || item.title;
        const barcode = d.identifiers?.find((i: any) => i.type === 'Barcode')?.value || null;

        const { error } = await supabase.from('lp_products').insert({
          title,
          artist,
          cover: d.images?.[0]?.uri || item.cover_image || null,
          format: 'LP',
          discogs_id: id,
          ean: barcode,
          description: d.notes || '',
          genres: d.genres || [],
          styles: d.styles || [],
          track_list: d.tracklist || [],
          release_date: d.released || null,
          last_synced_at: new Date().toISOString(),
        });

        if (error) {
          if (error.code === '23505') {
            // unique constraint - 이미 존재, 조용히 스킵
            existingIds.add(id);
          } else {
            console.log(`  ❌ ${artist} - ${title}: ${error.message}`);
          }
        } else {
          inserted++;
          existingIds.add(id);
          console.log(`  ✅ [${inserted}/${TARGET}] ${artist} - ${title}`);
        }
      }
    }
  }

  console.log(`\n🎉 완료! 총 ${inserted}개 한국 음악 LP 추가됨`);
}

run().catch(console.error);
