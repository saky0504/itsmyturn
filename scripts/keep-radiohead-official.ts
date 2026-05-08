/**
 * Radiohead 정식 앨범만 남기고 나머지 삭제
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

const OFFICIAL_MASTERS = new Set([
  '13344',   // Pablo Honey
  '17008',   // The Bends
  '21491',   // OK Computer
  '21501',   // Kid A
  '2507',    // Amnesiac
  '16962',   // Hail To The Thief
  '21520',   // In Rainbows
  '311832',  // The King Of Limbs
  '998252',  // A Moon Shaped Pool
  '2363104', // Kid A Mnesia
  '21541',   // My Iron Lung (EP)
  '73745',   // The Best Of
]);

async function run() {
  const { data } = await supabase
    .from('lp_products')
    .select('id, title, artist, discogs_id')
    .ilike('artist', '%Radiohead%');

  if (!data) { console.error('조회 실패'); return; }
  console.log(`Radiohead 전체: ${data.length}개\n`);

  const headers = {
    'User-Agent': 'itsmyturn/1.0',
    'Accept': 'application/json',
    'Authorization': `Discogs token=${process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN}`,
  };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const toKeep: string[] = [];
  const toDelete: string[] = [];

  for (const r of data) {
    if (!r.discogs_id) { toDelete.push(r.id); console.log(`❌ no discogs_id: ${r.title}`); continue; }

    await sleep(1200);
    const res = await fetch(`https://api.discogs.com/releases/${r.discogs_id}`, { headers });
    if (!res.ok) {
      if (res.status === 429) await sleep(30000);
      console.log(`⚠️ API ${res.status}, 일단 유지: ${r.title}`);
      toKeep.push(r.id);
      continue;
    }
    const d = await res.json();
    const mid = d.master_id ? String(d.master_id) : null;

    if (mid && OFFICIAL_MASTERS.has(mid)) {
      toKeep.push(r.id);
      console.log(`✅ 유지: ${r.title} (master: ${mid})`);
    } else {
      toDelete.push(r.id);
      console.log(`❌ 삭제: ${r.title} (master: ${mid || 'none'})`);
    }
  }

  console.log(`\n유지: ${toKeep.length}개, 삭제: ${toDelete.length}개`);

  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50);
      const { error } = await supabase.from('lp_products').delete().in('id', batch);
      if (error) console.error('삭제 실패:', error);
    }
    console.log(`✅ ${toDelete.length}개 삭제 완료`);
  }
}

run().catch(console.error);
