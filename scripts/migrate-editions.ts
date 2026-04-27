/**
 * 에디션 그룹핑 마이그레이션 스크립트
 * 
 * 1단계: 기존 lp_products에서 같은 title+artist 중복 탐지
 * 2단계: Discogs API로 master_id 조회
 * 3단계: 중복 상품을 lp_editions로 마이그레이션
 * 
 * 실행: npx tsx scripts/migrate-editions.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env 파일 로드
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
const discogsToken = process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Discogs API 호출 (rate limit 대응)
async function discogsGet(url: string): Promise<any> {
  const headers: Record<string, string> = {
    'User-Agent': 'itsmyturn/1.0',
    'Accept': 'application/json',
  };
  if (discogsToken) {
    headers['Authorization'] = `Discogs token=${discogsToken}`;
  }

  const res = await fetch(url, { headers });
  if (res.status === 429) {
    console.log('⏳ Rate limit, 60초 대기...');
    await new Promise(r => setTimeout(r, 60000));
    return discogsGet(url);
  }
  if (!res.ok) throw new Error(`Discogs API ${res.status}: ${res.statusText}`);
  return res.json();
}

// 에디션 라벨 생성
function buildEditionLabel(release: any): string {
  const parts: string[] = [];

  // 국가
  const country = release.country || '';
  if (country) {
    const countryMap: Record<string, string> = {
      'South Korea': '한국',
      'Korea': '한국',
      'Japan': '일본',
      'US': 'US',
      'USA': 'US',
      'UK': 'UK',
      'Germany': '독일',
      'France': '프랑스',
      'Europe': 'EU',
    };
    const mapped = countryMap[country] || country;
    parts.push(mapped);
  }

  // 포맷 특성
  const formats = release.formats || [];
  for (const fmt of formats) {
    const descriptions: string[] = fmt.descriptions || [];
    const text: string = fmt.text || '';

    if (descriptions.some((d: string) => d.toLowerCase().includes('colored') || d.toLowerCase().includes('colour'))) {
      parts.push(text ? `컬러 (${text})` : '컬러');
    }
    if (descriptions.some((d: string) => d.toLowerCase().includes('limited'))) {
      parts.push('한정판');
    }
    if (descriptions.some((d: string) => d.toLowerCase().includes('reissue') || d.toLowerCase().includes('repress'))) {
      parts.push('재판');
    }
    if (descriptions.some((d: string) => d === '180g' || d.includes('180 Gram'))) {
      parts.push('180g');
    }
    
    // LP 수량
    const qty = parseInt(fmt.qty || '1', 10);
    if (qty > 1) {
      parts.push(`${qty}LP`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : '기본';
}

// 포맷 상세 문자열
function buildFormatDetail(release: any): string {
  const formats = release.formats || [];
  return formats.map((f: any) => {
    const name = f.name || '';
    const desc = (f.descriptions || []).join(', ');
    const text = f.text || '';
    return [name, desc, text].filter(Boolean).join(' - ');
  }).join('; ');
}

async function main() {
  console.log('🔍 1단계: 기존 데이터 분석...\n');

  // 모든 상품 가져오기
  const { data: products, error } = await supabase
    .from('lp_products')
    .select('id, title, artist, discogs_id, ean, cover, format, description, release_date')
    .order('title');

  if (error || !products) {
    console.error('❌ 상품 조회 실패:', error);
    return;
  }

  console.log(`📊 총 ${products.length}개 상품\n`);

  // title+artist 기준으로 그룹핑
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const key = `${(p.title || '').trim().toLowerCase()}:::${(p.artist || '').trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // 중복 그룹 찾기
  const duplicateGroups = [...groups.entries()].filter(([, items]) => items.length > 1);

  console.log(`📋 중복 그룹: ${duplicateGroups.length}개\n`);
  
  if (duplicateGroups.length === 0) {
    console.log('✅ 중복 없음! title+artist 기준으로 그룹핑할 상품이 없습니다.');
    console.log('\n하지만 모든 상품에 대해 master_id를 조회하고 에디션을 생성합니다...');
  }

  // 중복 그룹 미리보기
  for (const [key, items] of duplicateGroups) {
    const [title, artist] = key.split(':::');
    console.log(`  🔄 "${artist}" - "${title}" (${items.length}개)`);
    for (const item of items) {
      console.log(`     - discogs: ${item.discogs_id}, ean: ${item.ean}`);
    }
  }

  console.log('\n🔍 2단계: Discogs master_id 조회 및 에디션 생성...\n');

  let processedCount = 0;
  let editionsCreated = 0;
  let masterIdsUpdated = 0;
  let mergedCount = 0;

  // 모든 상품에 대해 master_id 조회
  for (const [key, items] of groups.entries()) {
    const [title, artist] = key.split(':::');
    const primaryProduct = items[0]; // 첫 번째를 대표 상품으로

    // 이미 master_id가 있는 경우 건너뛰기 (재실행 시)
    // 실제 DB에 master_id 컬럼이 있어야 동작

    // Discogs ID가 있는 상품의 master_id 조회
    let masterId: string | null = null;
    
    for (const item of items) {
      if (!item.discogs_id || item.discogs_id.startsWith('aladin-')) continue;
      
      try {
        const releaseData = await discogsGet(`https://api.discogs.com/releases/${item.discogs_id}`);
        
        if (releaseData.master_id) {
          masterId = String(releaseData.master_id);
          break;
        }
        
        await new Promise(r => setTimeout(r, 1100)); // rate limit
      } catch (e: any) {
        console.warn(`  ⚠️ Discogs 조회 실패 (${item.discogs_id}): ${e.message}`);
      }
    }

    if (items.length > 1) {
      // 중복 그룹: 첫 번째를 대표로, 나머지를 에디션으로 변환
      console.log(`\n🔄 병합: "${artist}" - "${title}" (${items.length}개 → 1개 + ${items.length}개 에디션)`);

      // 대표 상품에 master_id 설정
      if (masterId) {
        const { error: updateErr } = await supabase
          .from('lp_products')
          .update({ master_id: masterId })
          .eq('id', primaryProduct.id);

        if (!updateErr) masterIdsUpdated++;
      }

      // 모든 프레싱을 에디션으로 등록
      for (const item of items) {
        let label = '기본';
        let country = null;
        let year = null;
        let formatDetail = null;

        // Discogs에서 에디션 정보 가져오기
        if (item.discogs_id && !item.discogs_id.startsWith('aladin-')) {
          try {
            const releaseData = await discogsGet(`https://api.discogs.com/releases/${item.discogs_id}`);
            label = buildEditionLabel(releaseData);
            country = releaseData.country || null;
            year = releaseData.year || null;
            formatDetail = buildFormatDetail(releaseData);
            await new Promise(r => setTimeout(r, 1100));
          } catch (e: any) {
            console.warn(`    ⚠️ 에디션 정보 조회 실패: ${e.message}`);
          }
        }

        // lp_editions에 삽입
        const { error: editionErr } = await supabase
          .from('lp_editions')
          .insert({
            product_id: primaryProduct.id, // 대표 상품에 연결
            discogs_id: item.discogs_id,
            ean: item.ean,
            label,
            country,
            year: year || (item.release_date ? parseInt(item.release_date, 10) || null : null),
            format_detail: formatDetail || item.format,
          });

        if (!editionErr) {
          editionsCreated++;
          console.log(`    ✅ 에디션 생성: "${label}" (${item.discogs_id})`);
        } else {
          console.warn(`    ⚠️ 에디션 생성 실패:`, editionErr.message);
        }

        // 중복 상품의 offers를 대표 상품으로 이관
        if (item.id !== primaryProduct.id) {
          const { error: moveErr } = await supabase
            .from('lp_offers')
            .update({ product_id: primaryProduct.id })
            .eq('product_id', item.id);

          if (!moveErr) {
            // 중복 상품 삭제
            const { error: delErr } = await supabase
              .from('lp_products')
              .delete()
              .eq('id', item.id);
            
            if (!delErr) {
              mergedCount++;
              console.log(`    🗑️ 중복 상품 삭제: ${item.id}`);
            }
          }
        }
      }
    } else {
      // 단일 상품: master_id만 설정하고 기본 에디션 생성
      if (masterId) {
        await supabase
          .from('lp_products')
          .update({ master_id: masterId })
          .eq('id', primaryProduct.id);
        masterIdsUpdated++;
      }

      // 기본 에디션 생성
      if (primaryProduct.discogs_id && !primaryProduct.discogs_id.startsWith('aladin-')) {
        let label = '기본';
        let country = null;
        let year = null;
        let formatDetail = null;

        try {
          const releaseData = await discogsGet(`https://api.discogs.com/releases/${primaryProduct.discogs_id}`);
          label = buildEditionLabel(releaseData);
          country = releaseData.country || null;
          year = releaseData.year || null;
          formatDetail = buildFormatDetail(releaseData);
          await new Promise(r => setTimeout(r, 1100));
        } catch (e: any) {
          // 조회 실패 시 기본값 유지
        }

        await supabase
          .from('lp_editions')
          .insert({
            product_id: primaryProduct.id,
            discogs_id: primaryProduct.discogs_id,
            ean: primaryProduct.ean,
            label,
            country,
            year: year || (primaryProduct.release_date ? parseInt(primaryProduct.release_date, 10) || null : null),
            format_detail: formatDetail || primaryProduct.format,
          });
        editionsCreated++;
      }
    }

    processedCount++;
    if (processedCount % 10 === 0) {
      console.log(`\n📊 진행: ${processedCount}/${groups.size} 그룹 처리됨`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 마이그레이션 완료!');
  console.log(`  📦 처리된 그룹: ${processedCount}`);
  console.log(`  🔗 master_id 설정: ${masterIdsUpdated}`);
  console.log(`  📝 에디션 생성: ${editionsCreated}`);
  console.log(`  🗑️ 병합된 중복: ${mergedCount}`);
}

main().catch(console.error);
