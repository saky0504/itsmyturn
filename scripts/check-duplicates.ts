/**
 * 중복 앨범 탐지 스크립트 (읽기 전용, 수정 없음)
 * title+artist 기준으로 중복 상품을 찾아 보여줍니다.
 * 
 * 실행: npx tsx scripts/check-duplicates.ts
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 중복 앨범 탐지 (읽기 전용)\n');

  const { data: products, error } = await supabase
    .from('lp_products')
    .select('id, title, artist, discogs_id, ean, format, release_date')
    .order('title');

  if (error || !products) {
    console.error('❌ 조회 실패:', error);
    return;
  }

  console.log(`📊 총 ${products.length}개 상품\n`);

  // 그룹핑
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const key = `${(p.title || '').trim().toLowerCase()}:::${(p.artist || '').trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const duplicates = [...groups.entries()].filter(([, items]) => items.length > 1);

  if (duplicates.length === 0) {
    console.log('✅ 중복 없음!');
    console.log(`\n📋 요약: ${groups.size}개 고유 앨범, ${products.length}개 상품`);
    return;
  }

  console.log(`🔄 중복 그룹 ${duplicates.length}개 발견:\n`);

  let totalDuplicateProducts = 0;
  for (const [key, items] of duplicates) {
    const [title, artist] = key.split(':::');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎵 "${artist}" - "${title}" (${items.length}개)`);
    for (const item of items) {
      console.log(`   ID: ${item.id}`);
      console.log(`   Discogs: ${item.discogs_id || '없음'}`);
      console.log(`   EAN: ${item.ean || '없음'}`);
      console.log(`   Format: ${item.format || '없음'}`);
      console.log(`   Year: ${item.release_date || '없음'}`);
      console.log('');
    }
    totalDuplicateProducts += items.length;
  }

  console.log(`\n📋 요약:`);
  console.log(`   총 상품: ${products.length}개`);
  console.log(`   고유 앨범: ${groups.size}개`);
  console.log(`   중복 그룹: ${duplicates.length}개`);
  console.log(`   중복 상품 수: ${totalDuplicateProducts}개`);
  console.log(`   병합 후 예상: ${products.length - (totalDuplicateProducts - duplicates.length)}개 상품`);
}

main().catch(console.error);
