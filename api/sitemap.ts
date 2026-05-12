import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const BASE_URL = 'https://itsmyturn.app';

// 유명 아티스트 화이트리스트 — sitemap 우선순위 부여 기준
// 추가/수정 시 여기만 손대면 됨
const FAMOUS_ARTISTS = [
  'beatles',
  'pink floyd',
  'queen',
  'led zeppelin',
  'radiohead',
  'oasis',
  'pearl jam',
  'nirvana',
  'fleetwood mac',
  'david bowie',
  'rolling stones',
  'michael jackson',
  'bob dylan',
  'bruce springsteen',
  'the doors',
  'ac/dc',
  'metallica',
  'u2',
  'coldplay',
  'bts',
  '방탄소년단',
  'blackpink',
  'iu',
  '아이유',
  '태연',
  'taeyeon',
  'newjeans',
  '뉴진스',
];

function isFamous(artist: string | null): boolean {
  if (!artist) return false;
  const a = artist.toLowerCase();
  return FAMOUS_ARTISTS.some((f) => a.includes(f));
}

type UrlEntry = {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
};

export default async function handler(_req: Request): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const staticUrls: UrlEntry[] = [
    { loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${BASE_URL}/market`, changefreq: 'daily', priority: '0.9' },
    { loc: `${BASE_URL}/market/list`, changefreq: 'daily', priority: '0.8' },
  ];

  // Tier S(유명+offer, daily/1.0) → A(offer, weekly/0.8) → B(유명만, monthly/0.5)
  // 그 외는 sitemap 제외 (crawl budget 보호)
  const tierS: UrlEntry[] = [];
  const tierA: UrlEntry[] = [];
  const tierB: UrlEntry[] = [];

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1) offers가 있는 product_id 셋 수집
      const offerSet = new Set<string>();
      {
        const PAGE_SIZE = 1000;
        for (let from = 0; from < 200000; from += PAGE_SIZE) {
          const { data: page, error } = await supabase
            .from('lp_offers')
            .select('product_id')
            .order('product_id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
          if (error || !page || page.length === 0) break;
          for (const o of page) {
            if (o.product_id) offerSet.add(o.product_id as string);
          }
          if (page.length < PAGE_SIZE) break;
        }
      }

      // 2) LP 전체 페이지네이션해서 분류
      const PAGE_SIZE = 1000;
      const MAX_PRODUCTS = 50000; // sitemaps.org 한도
      for (let from = 0; from < MAX_PRODUCTS; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lp_products')
          .select('id, artist, updated_at')
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error || !page || page.length === 0) break;

        for (const p of page) {
          const hasOffer = offerSet.has(p.id);
          const famous = isFamous(p.artist as string | null);
          const lastmod = p.updated_at ? (p.updated_at as string).split('T')[0] : undefined;
          const loc = `${BASE_URL}/market/lp/${p.id}`;

          if (famous && hasOffer) {
            tierS.push({ loc, changefreq: 'daily', priority: '1.0', lastmod });
          } else if (hasOffer) {
            tierA.push({ loc, changefreq: 'weekly', priority: '0.8', lastmod });
          } else if (famous) {
            tierB.push({ loc, changefreq: 'monthly', priority: '0.5', lastmod });
          }
          // else: sitemap 제외
        }

        if (page.length < PAGE_SIZE) break;
      }
    } catch {
      // Supabase 오류 시 정적 URL만 반환
    }
  }

  const allUrls: UrlEntry[] = [...staticUrls, ...tierS, ...tierA, ...tierB];
  const today = new Date().toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod || today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // 엣지 1시간 캐시 + 24시간 stale-while-revalidate
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'x-sitemap-stats': `s=${tierS.length},a=${tierA.length},b=${tierB.length}`,
    },
  });
}
