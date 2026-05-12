/**
 * Pearl Jam 정식 앨범만 남기고 부틀렉/단발 라이브 삭제 + 블록리스트 적재
 */
import { runKeepOfficial } from './keep-official';

const OFFICIAL = new Set([
  // 스튜디오 앨범
  '73754',   // Vs.
  '73769',   // Vitalogy
  '115933',  // No Code
  '73721',   // Yield
  '72997',   // Binaural
  '90780',   // Riot Act
  '90786',   // Pearl Jam (2006 self-titled)
  '183300',  // Backspacer
  '606964',  // Lightning Bolt
  '1705795', // Gigaton
  '3461333', // Dark Matter

  // 공식 컴필레이션 / 라이브 / 기타
  '118154',  // Lost Dogs (B-sides)
  '118157',  // Rearviewmirror (Greatest Hits)
  '82524',   // Live On Two Legs
  '304395',  // Live On Ten Legs
  '1330087', // MTV Unplugged
  '370052',  // Twenty (OST)
  '1232661', // Let's Play Two
  '118156',  // Oct. 22, 2003 - Benaroya Hall
  '1057701', // Live At Third Man Records
  '327542',  // Vs. / Vitalogy 리이슈
]);

runKeepOfficial({
  artistPattern: '%Pearl Jam%',
  artistTag: 'Pearl Jam',
  officialMasters: OFFICIAL,
  noMasterPolicy: 'delete',
}).catch(console.error);
