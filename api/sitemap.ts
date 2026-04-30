import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const BASE_URL = 'https://itsmyturn.app';

export default async function handler(_req: Request): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const staticUrls: { loc: string; changefreq: string; priority: string; lastmod?: string }[] = [
    { loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${BASE_URL}/market`, changefreq: 'daily', priority: '0.9' },
    { loc: `${BASE_URL}/market/list`, changefreq: 'daily', priority: '0.8' },
  ];

  let productUrls: { loc: string; changefreq: string; priority: string; lastmod?: string }[] = [];

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: products } = await supabase
        .from('lp_products')
        .select('id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5000);

      if (products) {
        productUrls = products.map((p) => ({
          loc: `${BASE_URL}/market/lp/${p.id}`,
          changefreq: 'weekly',
          priority: '0.7',
          lastmod: p.updated_at ? p.updated_at.split('T')[0] : undefined,
        }));
      }
    } catch {
      // Supabase 오류 시 정적 URL만 반환
    }
  }

  const allUrls = [...staticUrls, ...productUrls];
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
      // 브라우저는 캐시 안 함 (max-age=0), CDN/Vercel만 캐시 (s-maxage)
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
