/**
 * Discogs에서 특정 아티스트 LP 가져오기 (master_id 기반 중복 완전 차단)
 * - discogs_id 체크 (lp_products + lp_editions)
 * - master_id 체크 (같은 앨범의 모든 에디션/번역판 차단)
 *
 * 사용법: npx tsx scripts/fetch-beatles.ts "Pink Floyd"
 *         npx tsx scripts/fetch-beatles.ts  (기본: The Beatles)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN!;

const ARTIST_NAME = process.argv[2] || 'The Beatles';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const headers = {
  'User-Agent': 'itsmyturn/1.0',
  'Accept': 'application/json',
  'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
};

async function run() {
  console.log(`🎸 아티스트: ${ARTIST_NAME}\n`);

  // 1) 기존 discogs_id 수집
  const { data: existingProducts } = await supabase
    .from('lp_products')
    .select('discogs_id')
    .not('discogs_id', 'is', null);

  const { data: existingEditions } = await supabase
    .from('lp_editions')
    .select('discogs_id')
    .not('discogs_id', 'is', null);

  const existingIds = new Set<string>();
  (existingProducts || []).forEach((r: any) => existingIds.add(String(r.discogs_id)));
  (existingEditions || []).forEach((r: any) => existingIds.add(String(r.discogs_id)));

  // 2) 기존 master_id 수집 — DB에 있는 모든 앨범의 master_id를 Discogs에서 조회
  console.log('기존 앨범의 master_id 수집 중...');
  const existingMasters = new Set<string>();
  const allProducts = await supabase
    .from('lp_products')
    .select('discogs_id')
    .not('discogs_id', 'is', null);

  // 기존 앨범 중 이 아티스트 것만 master_id 조회 (API 호출 절약)
  const artistProducts = await supabase
    .from('lp_products')
    .select('discogs_id')
    .not('discogs_id', 'is', null)
    .ilike('artist', `%${ARTIST_NAME}%`);

  for (const p of (artistProducts.data || [])) {
    await sleep(1200);
    const res = await fetch(`https://api.discogs.com/releases/${p.discogs_id}`, { headers });
    if (!res.ok) {
      if (res.status === 429) await sleep(30000);
      continue;
    }
    const d = await res.json();
    if (d.master_id) {
      existingMasters.add(String(d.master_id));
    }
  }

  // 3) 블록리스트 master_id 수집 — 부틀렉/잘못된 데이터로 분류되어 재수집 금지
  const { data: blocklist } = await supabase
    .from('lp_master_blocklist')
    .select('master_id');
  const blockedMasters = new Set<string>((blocklist || []).map((b: any) => String(b.master_id)));

  console.log(`DB 기존 ID: ${existingIds.size}개, 기존 master: ${existingMasters.size}개, 블록 master: ${blockedMasters.size}개\n`);

  let inserted = 0;
  let blockedSkipped = 0;
  const seenMasters = new Set<string>();

  // 3) Discogs 검색
  for (let page = 1; page <= 20; page++) {
    const url = `https://api.discogs.com/database/search?artist=${encodeURIComponent(ARTIST_NAME)}&format=LP&type=release&sort=want&sort_order=desc&per_page=50&page=${page}`;
    console.log(`🔍 page ${page}`);

    await sleep(1200);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`  ⚠️ ${res.status}`);
      if (res.status === 429) { await sleep(30000); continue; }
      break;
    }

    const data = await res.json();
    const results: any[] = data.results || [];
    if (results.length === 0) { console.log('  결과 없음, 종료'); break; }
    console.log(`  ${results.length}개 결과`);

    // 검색 결과에 master_id가 있으면 먼저 체크 (API 호출 절약)
    for (const item of results) {
      const id = String(item.id);
      if (existingIds.has(id)) continue;

      // master_id가 검색 결과에 있으면 먼저 체크
      if (item.master_id) {
        const mid = String(item.master_id);
        if (blockedMasters.has(mid)) { blockedSkipped++; continue; }
        if (existingMasters.has(mid) || seenMasters.has(mid)) {
          continue;
        }
      }

      // 상세 정보 가져오기
      await sleep(1200);
      const detailRes = await fetch(`https://api.discogs.com/releases/${id}`, { headers });
      if (!detailRes.ok) {
        if (detailRes.status === 429) await sleep(30000);
        continue;
      }
      const d = await detailRes.json();

      // master_id 중복/블록 체크
      if (d.master_id) {
        const mid = String(d.master_id);
        if (blockedMasters.has(mid)) { blockedSkipped++; continue; }
        if (existingMasters.has(mid) || seenMasters.has(mid)) {
          continue;
        }
        seenMasters.add(mid);
        existingMasters.add(mid);
      }

      const artist = (d.artists || [])
        .map((a: any) => a.name.replace(/\s*\(\d+\)\s*$/, ''))
        .join(', ') || ARTIST_NAME;
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
        } else {
          console.log(`  ❌ ${artist} - ${title}: ${error.message}`);
        }
      } else {
        inserted++;
        existingIds.add(id);
        console.log(`  ✅ [${inserted}] ${artist} - ${title}`);
      }
    }
  }

  console.log(`\n🎉 완료! ${ARTIST_NAME} LP ${inserted}개 추가됨 (블록리스트로 스킵: ${blockedSkipped}개)`);
}

run().catch(console.error);
