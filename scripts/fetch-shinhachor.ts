/**
 * Discogs에서 신해철 LP 앨범 긁어오기 (중복 제외)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN!;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const headers = {
  'User-Agent': 'itsmyturn/1.0',
  'Accept': 'application/json',
  'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
};

async function run() {
  const { data: existing } = await supabase
    .from('lp_products')
    .select('discogs_id')
    .not('discogs_id', 'is', null);

  const existingIds = new Set((existing || []).map((r: any) => String(r.discogs_id)));
  console.log(`DB 기존 상품: ${existingIds.size}개`);

  const seenIds = new Set<string>();
  let inserted = 0;

  const SEARCH_QUERIES = [
    'q=%EC%8B%A0%ED%95%B4%EC%B2%A0&type=release&format=LP&country=South+Korea&sort=want&sort_order=desc',
    'artist=%EC%8B%A0%ED%95%B4%EC%B2%A0&type=release&format=LP&sort=want&sort_order=desc',
    'q=Shin+Hae+Chul&type=release&format=LP&country=South+Korea&sort=want&sort_order=desc',
    'q=N.EX.T&type=release&format=LP&country=South+Korea&sort=want&sort_order=desc',
    'q=Nexus&artist=%EC%8B%A0%ED%95%B4%EC%B2%A0&type=release&format=LP&sort=want&sort_order=desc',
  ];

  for (const query of SEARCH_QUERIES) {
    for (let page = 1; page <= 10; page++) {
      const url = `https://api.discogs.com/database/search?${query}&per_page=50&page=${page}`;
      console.log(`\n🔍 페이지 ${page}: ${url}`);

      await sleep(1200);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn(`  ⚠️ ${res.status} - 스킵`);
        break;
      }
      const data = await res.json();
      const results: any[] = data.results || [];
      const totalPages = data.pagination?.pages || 1;

      console.log(`  ${results.length}개 결과 (총 ${totalPages}페이지)`);
      if (results.length === 0) break;

      for (const item of results) {
        const id = String(item.id);
        if (existingIds.has(id) || seenIds.has(id)) {
          console.log(`  ⏭️ 스킵 (중복): ${item.title}`);
          continue;
        }
        seenIds.add(id);

        await sleep(1200);
        const detailRes = await fetch(`https://api.discogs.com/releases/${id}`, { headers });
        if (!detailRes.ok) {
          if (detailRes.status === 429) {
            console.log('  ⏳ Rate limit - 30초 대기...');
            await sleep(30000);
          }
          continue;
        }
        const d = await detailRes.json();

        const artist = (d.artists || [])
          .map((a: any) => a.name.replace(/\s*\(\d+\)\s*$/, ''))
          .join(', ') || item.title?.split(' - ')[0] || '신해철';
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
            existingIds.add(id);
            console.log(`  ⏭️ DB 중복: ${artist} - ${title}`);
          } else {
            console.log(`  ❌ ${artist} - ${title}: ${error.message}`);
          }
        } else {
          inserted++;
          existingIds.add(id);
          console.log(`  ✅ [${inserted}] ${artist} - ${title}`);
        }
      }

      if (page >= totalPages) break;
    }
  }

  console.log(`\n🎉 완료! 신해철 LP ${inserted}개 추가됨`);
}

run().catch(console.error);
