import { next, rewrite } from '@vercel/edge';

export const config = {
  matcher: ['/market/lp/:id*'],
};

const CRAWLER_PATTERN =
  /(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|kakaotalk-scrap|KAKAOTALK|Line|Daum|NaverBot|Yeti|Pinterest|redditbot|Applebot|bingbot|Googlebot)/i;

const BASE_URL = 'https://itsmyturn.app';

interface ProductMeta {
  id: string;
  title: string;
  artist: string | null;
  cover: string | null;
  lowestPrice: number | null;
  offerCount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value) + '원';
}

async function fetchProduct(id: string): Promise<ProductMeta | null> {
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const productRes = await fetch(
      `${supabaseUrl}/rest/v1/lp_products?id=eq.${encodeURIComponent(id)}&select=id,title,artist,cover`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (!productRes.ok) return null;
    const products = (await productRes.json()) as Array<{
      id: string;
      title: string;
      artist: string | null;
      cover: string | null;
    }>;
    const product = products[0];
    if (!product) return null;

    const offersRes = await fetch(
      `${supabaseUrl}/rest/v1/lp_offers?product_id=eq.${encodeURIComponent(id)}&select=base_price,shipping_fee,is_stock_available`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
      }
    );
    let lowestPrice: number | null = null;
    let offerCount = 0;
    if (offersRes.ok) {
      const offers = (await offersRes.json()) as Array<{
        base_price: number | null;
        shipping_fee: number | null;
        is_stock_available: boolean | null;
      }>;
      const available = offers.filter((o) => o.is_stock_available !== false && o.base_price);
      offerCount = available.length;
      if (available.length > 0) {
        lowestPrice = Math.min(
          ...available.map((o) => (o.base_price || 0) + (o.shipping_fee || 0))
        );
      }
    }

    return {
      id: product.id,
      title: product.title,
      artist: product.artist,
      cover: product.cover,
      lowestPrice,
      offerCount,
    };
  } catch {
    return null;
  }
}

function buildMetaTags(product: ProductMeta, url: string): string {
  const titleBase = product.artist
    ? `${product.title} - ${product.artist}`
    : product.title;
  const title = `${titleBase} | it's my turn`;
  const description = product.lowestPrice
    ? `${titleBase} LP 레코드 최저가 ${formatKrw(product.lowestPrice)}. 국내 ${product.offerCount}개 판매처 가격 비교.`
    : `${titleBase} LP 레코드 가격 비교. 네이버, 알라딘, Yes24, 교보문고.`;

  const ogImage = `${BASE_URL}/api/og/lp/${encodeURIComponent(product.id)}`;
  const fallbackImage = product.cover || `${BASE_URL}/og-image.png`;

  return `
    <meta property="og:title" content="${escapeHtml(title)}" data-dynamic="1" />
    <meta property="og:description" content="${escapeHtml(description)}" data-dynamic="1" />
    <meta property="og:type" content="product" data-dynamic="1" />
    <meta property="og:url" content="${escapeHtml(url)}" data-dynamic="1" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" data-dynamic="1" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImage)}" data-dynamic="1" />
    <meta property="og:image:width" content="1200" data-dynamic="1" />
    <meta property="og:image:height" content="630" data-dynamic="1" />
    <meta property="og:image:alt" content="${escapeHtml(titleBase)}" data-dynamic="1" />
    <meta property="og:site_name" content="It's My Turn" data-dynamic="1" />
    <meta property="og:locale" content="ko_KR" data-dynamic="1" />
    <meta name="twitter:card" content="summary_large_image" data-dynamic="1" />
    <meta name="twitter:title" content="${escapeHtml(title)}" data-dynamic="1" />
    <meta name="twitter:description" content="${escapeHtml(description)}" data-dynamic="1" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" data-dynamic="1" />
    <meta name="twitter:image:alt" content="${escapeHtml(titleBase)}" data-dynamic="1" />
    <meta property="og:image:fallback" content="${escapeHtml(fallbackImage)}" data-dynamic="1" />
    <title>${escapeHtml(title)}</title>
  `.trim();
}

export default async function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!CRAWLER_PATTERN.test(userAgent)) {
    return next();
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/market\/lp\/([^/?#]+)/);
  if (!match) return next();

  const productId = decodeURIComponent(match[1]);
  const product = await fetchProduct(productId);
  if (!product) return next();

  const htmlRes = await fetch(new URL('/index.html', url.origin), {
    headers: { 'x-middleware-request': '1' },
  });

  if (!htmlRes.ok) return next();

  let html = await htmlRes.text();
  const metaTags = buildMetaTags(product, url.toString());

  html = html.replace(
    /<meta\s+property="og:(title|description|type|url|image|image:secure_url|image:width|image:height|image:alt|site_name|locale)"[^>]*>/gi,
    ''
  );
  html = html.replace(
    /<meta\s+name="twitter:(card|title|description|image|image:alt)"[^>]*>/gi,
    ''
  );
  html = html.replace(/<title>[^<]*<\/title>/i, '');

  html = html.replace('</head>', `${metaTags}\n</head>`);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
      'x-og-injected': '1',
    },
  });
}
