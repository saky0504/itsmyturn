/**
 * 임의 아티스트의 master_id 분포 조사
 * 사용법: npx tsx scripts/list-masters.ts "Nirvana"
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const ARTIST = process.argv[2];
if (!ARTIST) { console.error('아티스트 이름 필요'); process.exit(1); }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data } = await supabase
    .from('lp_products')
    .select('id, title, artist, discogs_id')
    .ilike('artist', `%${ARTIST}%`);

  if (!data) return;
  console.log(`${ARTIST} 전체: ${data.length}개\n`);

  const headers = {
    'User-Agent': 'itsmyturn/1.0',
    'Accept': 'application/json',
    'Authorization': `Discogs token=${process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN}`,
  };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const masterToTitles = new Map<string, string[]>();

  for (const r of data) {
    if (!r.discogs_id) {
      console.log(`  [no discogs_id] ${r.title}`);
      const arr = masterToTitles.get('no-discogs-id') || [];
      arr.push(r.title);
      masterToTitles.set('no-discogs-id', arr);
      continue;
    }
    await sleep(1200);
    const res = await fetch(`https://api.discogs.com/releases/${r.discogs_id}`, { headers });
    if (!res.ok) {
      if (res.status === 429) await sleep(30000);
      console.log(`  [API ${res.status}] ${r.title}`);
      continue;
    }
    const d: any = await res.json();
    const mid = d.master_id ? String(d.master_id) : 'no-master';
    const arr = masterToTitles.get(mid) || [];
    arr.push(r.title);
    masterToTitles.set(mid, arr);
    console.log(`  ${r.title} → ${mid}`);
  }

  console.log(`\n=== master_id 별 그룹 (${masterToTitles.size}개) ===`);
  const sorted = [...masterToTitles.entries()].sort((a, b) => {
    if (a[0] === 'no-master') return 1;
    if (b[0] === 'no-master') return -1;
    return b[1].length - a[1].length;
  });
  for (const [mid, titles] of sorted) {
    const sample = titles.slice(0, 3).join(' | ');
    const more = titles.length > 3 ? ` (+${titles.length - 3})` : '';
    console.log(`${mid}: ${sample}${more}`);
  }
}

run().catch(console.error);
