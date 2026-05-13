/**
 * The Beatles 정식 앨범만 남기기
 */
import { runKeepOfficial } from './keep-official';

const OFFICIAL = new Set([
  // 스튜디오 (UK)
  '45362',   // Please Please Me
  '45729',   // With The Beatles
  '24003',   // A Hard Day's Night
  '45799',   // Beatles For Sale
  '45895',   // Help!
  '45526',   // Rubber Soul
  '45284',   // Revolver
  '23934',   // Sgt. Pepper's (Spanish title release)
  '54463',   // Magical Mystery Tour
  '46402',   // The Beatles (White Album)
  '54565',   // Yellow Submarine
  '24047',   // Abbey Road
  '24212',   // Let It Be

  // 미국 발매 정식판
  '75259',   // Meet The Beatles!
  '59364',   // Yesterday And Today
  '507400',  // A Hard Day's Night OST (US)

  // 공식 컴필 / 박스 / 리믹스
  '23881',   // 1962-1966 (Red Album)
  '24155',   // 1967-1970 (Blue Album)
  '447254',  // 1 (2000)
  '59388',   // Anthology 1
  '59393',   // Anthology 2
  '59442',   // Let It Be... Naked
  '490445',  // The Beatles In Mono
  '123245',  // Mono Masters
  '59435',   // The Beatles Collection (1978 박스)
]);

runKeepOfficial({
  artistPattern: '%Beatles%',
  artistTag: 'The Beatles',
  officialMasters: OFFICIAL,
  noMasterPolicy: 'delete',
}).catch(console.error);
