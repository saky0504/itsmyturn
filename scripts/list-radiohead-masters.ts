/**
 * Radiohead 앨범 master_id 조회용
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data } = await supabase
    .from('lp_products')
    .select('id, title, artist, discogs_id')
    .ilike('artist', '%Radiohead%');

  if (!data) return;
  console.log(`Radiohead 전체: ${data.length}개\n`);

  const headers = {
    'User-Agent': 'itsmyturn/1.0',
    'Accept': 'application/json',
    'Authorization': `Discogs token=${process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN}`,
  };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const result: Array<{ title: string; master: string }> = [];

  for (const r of data) {
    if (!r.discogs_id) { console.log(`  ${r.title} → no discogs_id`); continue; }
    await sleep(1200);
    const res = await fetch(`https://api.discogs.com/releases/${r.discogs_id}`, { headers });
    if (!res.ok) {
      if (res.status === 429) await sleep(30000);
      console.log(`  ${r.title} → API ${res.status}`);
      continue;
    }
    const d = await res.json();
    const mid = d.master_id ? String(d.master_id) : 'no-master';
    console.log(`  ${r.title} → master: ${mid}`);
    result.push({ title: r.title, master: mid });
  }

  // master_id별 그룹
  const groups = new Map<string, string[]>();
  for (const r of result) {
    if (!groups.has(r.master)) groups.set(r.master, []);
    groups.get(r.master)!.push(r.title);
  }

  console.log('\n=== master_id 별 그룹 ===');
  for (const [mid, titles] of [...groups.entries()].sort()) {
    console.log(`master ${mid}: ${titles.join(' | ')}`);
  }
}

run().catch(console.error);
