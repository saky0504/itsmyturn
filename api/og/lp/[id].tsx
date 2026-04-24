import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

const BASE_URL = 'https://itsmyturn.app';
const FALLBACK_COVER = `${BASE_URL}/og-image.png`;

function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value) + '원';
}

interface ProductData {
  title: string;
  artist: string | null;
  cover: string | null;
  lowestPrice: number | null;
  offerCount: number;
}

async function fetchProduct(id: string): Promise<ProductData | null> {
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
      `${supabaseUrl}/rest/v1/lp_products?id=eq.${encodeURIComponent(id)}&select=title,artist,cover`,
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
      title: string;
      artist: string | null;
      cover: string | null;
    }>;
    const product = products[0];
    if (!product) return null;

    let lowestPrice: number | null = null;
    let offerCount = 0;
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

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop() || '';

  const product = await fetchProduct(decodeURIComponent(id));

  const title = product?.title || "It's My Turn";
  const artist = product?.artist || 'LP 가격 비교';
  const cover = product?.cover || FALLBACK_COVER;
  const lowestPrice = product?.lowestPrice ?? null;
  const offerCount = product?.offerCount ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          padding: '60px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            gap: '50px',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: '420px',
              height: '420px',
              borderRadius: '18px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              flexShrink: 0,
              background: '#000',
            }}
          >
            <img
              src={cover}
              alt=""
              width={420}
              height={420}
              style={{ objectFit: 'cover' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              gap: '18px',
              color: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '22px',
                color: '#a0aec0',
                fontWeight: 500,
              }}
            >
              <span style={{ display: 'flex' }}>💿</span>
              <span>it's my turn · LP 가격 비교</span>
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: '54px',
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              {title.length > 40 ? title.slice(0, 40) + '…' : title}
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: '30px',
                color: '#cbd5e0',
                fontWeight: 500,
              }}
            >
              {artist.length > 36 ? artist.slice(0, 36) + '…' : artist}
            </div>

            {lowestPrice !== null && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginTop: '12px',
                  padding: '18px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  width: 'fit-content',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    fontSize: '18px',
                    color: '#a0aec0',
                    marginBottom: '4px',
                  }}
                >
                  최저가 ({offerCount}개 판매처)
                </span>
                <span
                  style={{
                    display: 'flex',
                    fontSize: '44px',
                    fontWeight: 800,
                    color: '#fbbf24',
                  }}
                >
                  {formatKrw(lowestPrice)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            right: '60px',
            display: 'flex',
            fontSize: '18px',
            color: '#718096',
            letterSpacing: '0.05em',
          }}
        >
          itsmyturn.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    }
  );
}
