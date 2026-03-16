/// <reference types="node" />
/**
 * 중복 앨범 정리 스크립트
 * "3집" vs "이문세 3집", "별에서 온 그대 O.S.T" vs "드라마 '별에서 온 그대' O.S.T" 등
 * 마케팅 접두어/아티스트 prefix로 인한 중복 레코드를 제거합니다.
 * 실행: npx tsx scripts/dedup-albums.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
    const envPath = resolve(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach((line: string) => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^[\"']|[\"']$/g, '');
            if (!process.env[key.trim()]) process.env[key.trim()] = value;
        }
    });
} catch { }

const supabaseUrl = process.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
const supabaseKey = process.env['VITE_SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL / SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/** 미디어 타입 접두어 + 공백 정규화 */
function normalizeTitle(raw: string): string {
    let t = (raw || '').trim();
    // 미디어 접두어 제거: "드라마 '별에서 온 그대' O.S.T" → "별에서 온 그대 O.S.T"
    const QUOTED = /^(?:드라마|영화|뮤지컬|애니메이션|애니|시트콤|웹드라마|웹툰|게임)\s*['''""""](.+?)['''""""]\s*/i;
    const BARE   = /^(?:드라마|영화|뮤지컬|애니메이션|애니|시트콤|웹드라마|웹툰|게임)\s+/i;
    if (QUOTED.test(t)) {
        t = t.replace(QUOTED, '$1 ').trim();
    } else {
        t = t.replace(BARE, '').trim();
    }
    return t.replace(/\s+/g, '').toLowerCase();
}

const normalizeArtist = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();

async function run() {
    console.log('🔍 Fetching all LP products...');
    const { data, error } = await supabase
        .from('lp_products')
        .select('id, title, artist, created_at')
        .order('created_at', { ascending: true }); // 오래된 것을 keeper로 유지

    if (error || !data) {
        console.error('❌ Failed to fetch:', error);
        process.exit(1);
    }

    const all = data;
    console.log(`📦 Total products: ${all.length}`);

    const toDelete = new Set<string>();

    for (let i = 0; i < all.length; i++) {
        if (toDelete.has(all[i].id)) continue;
        const a = all[i];
        const normArtist = normalizeArtist(a.artist);
        const normTitleA = normalizeTitle(a.title);
        const normCombinedA = normArtist + normTitleA; // e.g. "이문세3집"

        for (let j = i + 1; j < all.length; j++) {
            if (toDelete.has(all[j].id)) continue;
            const b = all[j];
            if (normalizeArtist(b.artist) !== normArtist) continue;

            const normTitleB = normalizeTitle(b.title);
            const normCombinedB = normArtist + normTitleB;

            const isDuplicate =
                normTitleB === normTitleA ||
                normTitleB === normCombinedA ||
                normTitleA === normCombinedB ||
                (normTitleB.startsWith(normArtist) && normTitleB.slice(normArtist.length) === normTitleA) ||
                (normTitleA.startsWith(normArtist) && normTitleA.slice(normArtist.length) === normTitleB);

            if (isDuplicate) {
                console.log(`🔁 Duplicate:`);
                console.log(`   KEEP  [${a.id}] "${a.title}" — ${a.artist}`);
                console.log(`   DEL   [${b.id}] "${b.title}" — ${b.artist}`);
                toDelete.add(b.id);
            }
        }
    }

    if (toDelete.size === 0) {
        console.log('✅ No duplicates found!');
        return;
    }

    console.log(`\n🗑️  ${toDelete.size} duplicates to delete...`);
    const ids = [...toDelete];

    // offers 먼저 삭제 (FK constraint)
    const { error: offersErr } = await supabase.from('lp_offers').delete().in('product_id', ids);
    if (offersErr) console.error('❌ Error deleting offers:', offersErr);

    const { error: productsErr } = await supabase.from('lp_products').delete().in('id', ids);
    if (productsErr) {
        console.error('❌ Error deleting products:', productsErr);
    } else {
        console.log(`✅ Deleted ${toDelete.size} duplicate products.`);
    }
}

run();
