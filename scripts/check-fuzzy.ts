/**
 * 특정 앨범의 중복 여부 확인 (퍼지 검색)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch { /* ignore */ }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  // 무한궤도 검색
  const { data, error } = await supabase
    .from('lp_products')
    .select('id, title, artist, discogs_id, ean')
    .ilike('title', '%우리 앞에%');

  if (error) { console.error(error); return; }

  console.log(`\n🔍 "우리 앞에" 검색 결과: ${data?.length}개\n`);
  for (const p of data || []) {
    console.log(`  title: [${p.title}]`);
    console.log(`  artist: [${p.artist}]`);
    console.log(`  discogs: ${p.discogs_id}`);
    console.log(`  ean: ${p.ean}`);
    console.log(`  key: "${p.title.trim().toLowerCase()}:::${p.artist.trim().toLowerCase()}"`);
    console.log('');
  }
}

main().catch(console.error);
