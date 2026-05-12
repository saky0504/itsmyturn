/**
 * Nirvana 정식 앨범만 남기고 부틀렉 삭제 + 블록리스트 적재
 */
import { runKeepOfficial } from './keep-official';

const OFFICIAL = new Set([
  '13814',   // Nevermind
  '20424',   // Incesticide
  '22433',   // MTV Unplugged In New York
  '42473',   // From The Muddy Banks Of The Wishkah
  '42476',   // Nirvana (2002 Best Of)
  '42459',   // Hormoaning EP (호주 투어 공식)
  '201031',  // Live At Reading (2009)
  '159960',  // Live At The Paramount (2019)
  '603664',  // Live And Loud (2019)
]);

runKeepOfficial({
  artistPattern: '%Nirvana%',
  artistTag: 'Nirvana',
  officialMasters: OFFICIAL,
  noMasterPolicy: 'delete',
}).catch(console.error);
