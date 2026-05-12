/**
 * LP 인기도 분석 — 유명 아티스트 / 가격정보 풍부도 / 평점 분포
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

const FAMOUS_ARTISTS = [
  'The Beatles', 'Beatles',
  'Pink Floyd',
  'Queen',
  'Led Zeppelin',
  'Radiohead',
  'Oasis',
  'Pearl Jam',
  'Nirvana',
  'Fleetwood Mac',
  'David Bowie',
  'The Rolling Stones', 'Rolling Stones',
  'Michael Jackson',
  'Bob Dylan',
  'Bruce Springsteen',
  'The Doors',
  'AC/DC',
  'Metallica',
  'U2',
  'Coldplay',
  'BTS', '방탄소년단',
  'BLACKPINK',
  'IU', '아이유',
  '태연',
  'NewJeans', '뉴진스',
];

async function run() {
  // 전체
  const { count: total } = await s.from('lp_products').select('*', { count: 'exact', head: true });
  console.log(`전체 LP: ${total}\n`);

  // offers 보유 LP
  const { data: offerData } = await s
    .from('lp_offers')
    .select('product_id')
    .limit(100000);
  const offerSet = new Set((offerData || []).map(o => o.product_id));
  console.log(`offers가 있는 LP: ${offerSet.size}\n`);

  // 유명 아티스트 LP
  let famousCount = 0;
  const famousBreakdown: Record<string, number> = {};
  for (const artist of FAMOUS_ARTISTS) {
    const { count } = await s
      .from('lp_products')
      .select('*', { count: 'exact', head: true })
      .ilike('artist', `%${artist}%`);
    if (count && count > 0) {
      famousBreakdown[artist] = count;
      famousCount += count;
    }
  }
  console.log('유명 아티스트 LP 개수:');
  for (const [a, c] of Object.entries(famousBreakdown).sort((x, y) => y[1] - x[1])) {
    console.log(`  ${a}: ${c}`);
  }
  console.log(`  합계 (중복 포함): ${famousCount}\n`);

  // rating이 달린 LP
  const { count: ratedCount } = await s
    .from('lp_products')
    .select('*', { count: 'exact', head: true })
    .gt('rating_count', 0);
  console.log(`평점이 1개 이상 달린 LP: ${ratedCount}\n`);

  // offers >= 1 인 LP 중 유명 아티스트
  const { data: famousWithOffers } = await s
    .from('lp_products')
    .select('id, title, artist')
    .or(FAMOUS_ARTISTS.map(a => `artist.ilike.%${a}%`).join(','))
    .limit(2000);
  const famousWithOffersCount = (famousWithOffers || []).filter(p => offerSet.has(p.id)).length;
  console.log(`유명 아티스트 + offers 보유: ${famousWithOffersCount}`);
}

run().catch(console.error);
