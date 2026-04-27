/**
 * 누락된 중복 앨범 수동 병합
 * Supabase의 기본 limit(1000)으로 인해 누락된 중복을 찾아 병합
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

const discogsToken = process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN;

async function discogsGet(url: string): Promise<any> {
  const headers: Record<string, string> = {
    'User-Agent': 'itsmyturn/1.0',
    'Accept': 'application/json',
  };
  if (discogsToken) headers['Authorization'] = `Discogs token=${discogsToken}`;
  const res = await fetch(url, { headers });
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 60000));
    return discogsGet(url);
  }
  if (!res.ok) throw new Error(`Discogs ${res.status}`);
  return res.json();
}

function buildEditionLabel(release: any): string {
  const parts: string[] = [];
  const country = release.country || '';
  if (country) {
    const map: Record<string, string> = {
      'South Korea': '한국', 'Korea': '한국', 'Japan': '일본',
      'US': 'US', 'USA': 'US', 'UK': 'UK', 'Europe': 'EU',
    };
    parts.push(map[country] || country);
  }
  const formats = release.formats || [];
  for (const fmt of formats) {
    const desc: string[] = fmt.descriptions || [];
    const text: string = fmt.text || '';
    if (desc.some((d: string) => d.toLowerCase().includes('colored') || d.toLowerCase().includes('colour')))
      parts.push(text ? `컬러 (${text})` : '컬러');
    if (desc.some((d: string) => d.toLowerCase().includes('limited'))) parts.push('한정판');
    if (desc.some((d: string) => d.toLowerCase().includes('reissue') || d.toLowerCase().includes('repress'))) parts.push('재판');
    if (desc.some((d: string) => d === '180g' || d.includes('180 Gram'))) parts.push('180g');
    const qty = parseInt(fmt.qty || '1', 10);
    if (qty > 1) parts.push(`${qty}LP`);
  }
  return parts.length > 0 ? parts.join(', ') : '기본';
}

async function main() {
  console.log('🔍 전체 상품 조회 (pagination 적용)...\n');

  // 1000개 이상 가져오기
  let allProducts: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('lp_products')
      .select('id, title, artist, discogs_id, ean, format, release_date')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('title');
    if (error) { console.error(error); return; }
    if (!data || data.length === 0) break;
    allProducts = allProducts.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`📊 총 ${allProducts.length}개 상품\n`);

  // 그룹핑
  const groups = new Map<string, typeof allProducts>();
  for (const p of allProducts) {
    const key = `${(p.title || '').trim().toLowerCase()}:::${(p.artist || '').trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const duplicates = [...groups.entries()].filter(([, items]) => items.length > 1);

  if (duplicates.length === 0) {
    console.log('✅ 중복 없음!');
    return;
  }

  console.log(`🔄 중복 ${duplicates.length}개 발견, 병합 시작...\n`);

  for (const [key, items] of duplicates) {
    const [title, artist] = key.split(':::');
    const primary = items[0];
    console.log(`\n🔄 "${artist}" - "${title}" (${items.length}개)`);

    for (const item of items) {
      // 에디션 이미 있는지 확인
      const { data: existing } = await supabase
        .from('lp_editions')
        .select('id')
        .eq('product_id', primary.id)
        .eq('discogs_id', item.discogs_id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  ⏭️ 에디션 이미 존재: ${item.discogs_id}`);
        
        // 중복 상품이면 offers 이관 후 삭제
        if (item.id !== primary.id) {
          await supabase.from('lp_offers').update({ product_id: primary.id }).eq('product_id', item.id);
          await supabase.from('lp_products').delete().eq('id', item.id);
          console.log(`  🗑️ 중복 삭제: ${item.id}`);
        }
        continue;
      }

      let label = '기본';
      let country = null;
      let year = null;

      if (item.discogs_id && !item.discogs_id.startsWith('aladin-')) {
        try {
          const rel = await discogsGet(`https://api.discogs.com/releases/${item.discogs_id}`);
          label = buildEditionLabel(rel);
          country = rel.country || null;
          year = rel.year || null;
          await new Promise(r => setTimeout(r, 1100));
        } catch (e: any) {
          console.warn(`  ⚠️ Discogs 오류: ${e.message}`);
        }
      }

      const { error: edErr } = await supabase.from('lp_editions').insert({
        product_id: primary.id,
        discogs_id: item.discogs_id,
        ean: item.ean,
        label,
        country,
        year: year || (item.release_date ? parseInt(item.release_date, 10) || null : null),
        format_detail: item.format,
      });

      if (!edErr) console.log(`  ✅ 에디션: "${label}" (${item.discogs_id})`);

      if (item.id !== primary.id) {
        await supabase.from('lp_offers').update({ product_id: primary.id }).eq('product_id', item.id);
        await supabase.from('lp_products').delete().eq('id', item.id);
        console.log(`  🗑️ 중복 삭제: ${item.id}`);
      }
    }
  }

  console.log('\n🎉 완료!');
}

main().catch(console.error);
