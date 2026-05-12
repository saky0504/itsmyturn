/**
 * 범용: 특정 아티스트의 정식 앨범(master_id 화이트리스트)만 남기고
 *      나머지는 삭제 + lp_master_blocklist 에 적재 → 재수집 차단
 *
 * 사용법:
 *   1) scripts/keep-<artist>.ts 를 만들고 OFFICIAL_MASTERS, ARTIST_PATTERN 설정
 *   2) 그 파일에서 이 모듈의 runKeepOfficial() 호출
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

export interface KeepOfficialOptions {
  artistPattern: string;       // ilike pattern (e.g. '%Nirvana%')
  artistTag: string;           // blocklist artist 컬럼에 저장할 표준 이름
  officialMasters: Set<string>;
  /**
   * "no-master" (master_id가 null인 release)를 어떻게 처리할지.
   *   - 'delete' (기본): 부틀렉/짝퉁일 확률 높음, 삭제
   *   - 'keep': 유지 (확신 없는 경우)
   */
  noMasterPolicy?: 'delete' | 'keep';
}

export async function runKeepOfficial(opts: KeepOfficialOptions) {
  dotenv.config({ path: ['.env.local', '.env'] });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
  );

  const headers = {
    'User-Agent': 'itsmyturn/1.0',
    'Accept': 'application/json',
    'Authorization': `Discogs token=${process.env.VITE_DISCOGS_TOKEN || process.env.DISCOGS_TOKEN}`,
  };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const { data } = await supabase
    .from('lp_products')
    .select('id, title, artist, discogs_id')
    .ilike('artist', opts.artistPattern);

  if (!data) { console.error('조회 실패'); return; }
  console.log(`${opts.artistTag} 전체: ${data.length}개\n`);

  const toDeleteIds: string[] = [];
  const blocklistRows: Array<{
    master_id: string;
    artist: string;
    reason: string;
    blocked_title: string;
    discogs_id: string | null;
  }> = [];
  const seenBlockMasters = new Set<string>();
  let kept = 0;

  for (const r of data) {
    if (!r.discogs_id) {
      toDeleteIds.push(r.id);
      console.log(`❌ no discogs_id: ${r.title}`);
      continue;
    }

    await sleep(1200);
    const res = await fetch(`https://api.discogs.com/releases/${r.discogs_id}`, { headers });
    if (!res.ok) {
      if (res.status === 429) await sleep(30000);
      console.log(`⚠️ API ${res.status}, 유지: ${r.title}`);
      continue;
    }
    const d: any = await res.json();
    const mid = d.master_id ? String(d.master_id) : null;

    if (mid && opts.officialMasters.has(mid)) {
      kept++;
      console.log(`✅ 유지: ${r.title} (master ${mid})`);
      continue;
    }

    // no-master 정책
    if (!mid && opts.noMasterPolicy === 'keep') {
      kept++;
      console.log(`➖ 유지 (no-master, policy=keep): ${r.title}`);
      continue;
    }

    toDeleteIds.push(r.id);
    // master_id 있는 것만 블록리스트에 적재 (no-master는 어차피 다음 스크랩에서 다른 release 됨)
    if (mid && !seenBlockMasters.has(mid)) {
      seenBlockMasters.add(mid);
      blocklistRows.push({
        master_id: mid,
        artist: opts.artistTag,
        reason: 'bootleg-or-unofficial',
        blocked_title: r.title,
        discogs_id: r.discogs_id,
      });
    }
    console.log(`❌ 삭제: ${r.title} (master ${mid ?? 'none'})`);
  }

  console.log(`\n유지: ${kept}, 삭제: ${toDeleteIds.length}, 블록리스트 추가: ${blocklistRows.length}`);

  // 1) 블록리스트 upsert (이미 있는 master_id는 무시)
  if (blocklistRows.length > 0) {
    const { error } = await supabase
      .from('lp_master_blocklist')
      .upsert(blocklistRows, { onConflict: 'master_id', ignoreDuplicates: true });
    if (error) console.error('블록리스트 적재 실패:', error);
    else console.log(`📛 블록리스트 ${blocklistRows.length}개 추가`);
  }

  // 2) 삭제
  if (toDeleteIds.length > 0) {
    for (let i = 0; i < toDeleteIds.length; i += 50) {
      const batch = toDeleteIds.slice(i, i + 50);
      const { error } = await supabase.from('lp_products').delete().in('id', batch);
      if (error) console.error('삭제 실패:', error);
    }
    console.log(`🗑  ${toDeleteIds.length}개 삭제 완료`);
  }
}
