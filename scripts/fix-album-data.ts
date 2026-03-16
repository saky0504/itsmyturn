/**
 * 앨범 데이터 정리 스크립트
 * 1. 알라딘 앨범 중 제목 형식이 잘못된 것 삭제 (아티스트명 - 앨범명 형식이 아닌 것)
 * 2. Discogs 아티스트명에서 ' (숫자)' suffix 제거 (예: "Adele (3)" → "Adele")
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
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
} catch {
    // .env not found
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Discogs 아티스트명에서 ' (숫자)' suffix 제거
// 예: "Adele (3)" → "Adele", "The Beatles" → "The Beatles" (변경 없음)
function cleanDiscogsArtist(name: string): string {
    return name.replace(/\s*\(\d+\)\s*$/, '').trim();
}

// 알라딘 앨범 제목 형식 검증
// 알라딘에서 가져온 앨범은 cleanAladinTitle()을 거쳤지만
// 아티스트가 "Unknown Artist"인 경우나 [수입] 태그가 남은 경우 등을 식별
function hasProblematicTitle(title: string, artist: string): boolean {
    // [수입], [중고] 같은 태그가 제목에 남아있는 경우
    if (/^\[.+\]/.test(title)) return true;
    // 제목이 너무 긴 경우 (마케팅 문구가 남은 것)
    if (title.length > 100) return true;
    // 아티스트가 Unknown이고 제목이 '아티스트 - 앨범' 형식인 경우 (이미 포함된 것)
    if (artist === 'Unknown Artist' && title.includes(' - ')) return true;
    return false;
}

async function main() {
    console.log('🔧 앨범 데이터 정리 시작...\n');

    // ========================================
    // Step 1: 알라딘 앨범 중 문제있는 제목 조회 및 삭제
    // ========================================
    console.log('📋 Step 1: 알라딘 앨범 제목 형식 문제 확인...');

    const { data: aladinAlbums, error: fetchError } = await supabase
        .from('lp_products')
        .select('id, title, artist, discogs_id')
        .like('discogs_id', 'aladin-%');

    if (fetchError) {
        console.error('❌ 알라딘 앨범 조회 실패:', fetchError);
    } else {
        console.log(`  총 알라딘 앨범: ${aladinAlbums?.length || 0}개`);

        const problematicAlbums = (aladinAlbums || []).filter(a =>
            hasProblematicTitle(a.title, a.artist)
        );

        console.log(`  🚨 문제있는 제목: ${problematicAlbums.length}개`);
        
        if (problematicAlbums.length > 0) {
            console.log('\n  삭제할 앨범 목록:');
            problematicAlbums.forEach(a => {
                console.log(`    - [${a.artist}] ${a.title}`);
            });

            console.log('\n  🗑️ 삭제 중...');
            const idsToDelete = problematicAlbums.map(a => a.id);
            
            // 관련 offer도 먼저 삭제
            const { error: offerError } = await supabase
                .from('lp_offers')
                .delete()
                .in('product_id', idsToDelete);
            
            if (offerError) {
                console.error('  ❌ offer 삭제 실패:', offerError);
            }

            // 상품 삭제
            const { error: deleteError } = await supabase
                .from('lp_products')
                .delete()
                .in('id', idsToDelete);

            if (deleteError) {
                console.error('  ❌ 앨범 삭제 실패:', deleteError);
            } else {
                console.log(`  ✅ ${problematicAlbums.length}개 문제 앨범 삭제 완료`);
            }
        } else {
            console.log('  ✅ 문제있는 제목 없음');
        }
    }

    // ========================================
    // Step 2: Discogs 아티스트명 ' (숫자)' suffix 제거
    // ========================================
    console.log('\n📋 Step 2: Discogs 아티스트명 suffix 정리...');

    // discogs_id가 aladin- 으로 시작하지 않는 것들 (Discogs에서 수집한 것)
    const { data: discogsAlbums, error: discogsError } = await supabase
        .from('lp_products')
        .select('id, title, artist, discogs_id')
        .not('discogs_id', 'like', 'aladin-%')
        .not('discogs_id', 'is', null);

    if (discogsError) {
        console.error('❌ Discogs 앨범 조회 실패:', discogsError);
    } else {
        console.log(`  총 Discogs 앨범: ${discogsAlbums?.length || 0}개`);

        const artistsWithSuffix = (discogsAlbums || []).filter(a =>
            a.artist && /\(\d+\)\s*$/.test(a.artist)
        );

        console.log(`  🚨 수정 필요한 아티스트명: ${artistsWithSuffix.length}개`);

        if (artistsWithSuffix.length > 0) {
            console.log('\n  수정할 아티스트 목록 (앞 20개):');
            artistsWithSuffix.slice(0, 20).forEach(a => {
                const cleaned = cleanDiscogsArtist(a.artist);
                console.log(`    - "${a.artist}" → "${cleaned}"  (${a.title})`);
            });
            if (artistsWithSuffix.length > 20) {
                console.log(`    ... 외 ${artistsWithSuffix.length - 20}개`);
            }

            console.log('\n  ✏️ 아티스트명 수정 중...');
            let fixedCount = 0;

            // 배치로 업데이트 (50개씩)
            const batchSize = 50;
            for (let i = 0; i < artistsWithSuffix.length; i += batchSize) {
                const batch = artistsWithSuffix.slice(i, i + batchSize);
                
                for (const album of batch) {
                    const cleanedArtist = cleanDiscogsArtist(album.artist);
                    const { error: updateError } = await supabase
                        .from('lp_products')
                        .update({ artist: cleanedArtist })
                        .eq('id', album.id);

                    if (updateError) {
                        console.error(`  ❌ 업데이트 실패 (${album.artist}):`, updateError);
                    } else {
                        fixedCount++;
                    }
                }
                
                // Rate limit
                if (i + batchSize < artistsWithSuffix.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            console.log(`  ✅ ${fixedCount}개 아티스트명 수정 완료`);
        } else {
            console.log('  ✅ 수정 필요한 아티스트명 없음');
        }
    }

    // ========================================
    // 최종 결과
    // ========================================
    const { data: finalCount } = await supabase
        .from('lp_products')
        .select('id', { count: 'exact', head: true });

    console.log('\n🎉 정리 완료!');
    console.log(`  현재 총 앨범 수: 확인 필요`);
}

main().catch(console.error);
