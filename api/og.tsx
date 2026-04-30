import { ImageResponse } from '@vercel/og';
import type { VercelRequest } from '@vercel/node';

export const config = { runtime: 'edge' };

export default async function handler(req: VercelRequest) {
  const { searchParams } = new URL(req.url as string, 'https://itsmyturn.app');
  const title = searchParams.get('title') || 'LP';
  const artist = searchParams.get('artist') || '';
  const cover = searchParams.get('cover') || '';
  const priceRaw = searchParams.get('price') || '';
  const price = priceRaw ? parseInt(priceRaw, 10) : null;
  const formattedPrice = price ? `₩${price.toLocaleString('ko-KR')}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #111111 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 장식 원 */}
        <div style={{
          position: 'absolute', top: '-120px', right: '-120px',
          width: '500px', height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', left: '320px',
          width: '300px', height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* 앨범 커버 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 50px 60px 60px',
          flexShrink: 0,
        }}>
          {cover ? (
            <img
              src={cover}
              width={430}
              height={430}
              style={{
                borderRadius: '12px',
                objectFit: 'cover',
                boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
              }}
            />
          ) : (
            <div style={{
              width: '430px', height: '430px',
              borderRadius: '12px',
              background: '#2a2a2a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '80px' }}>🎵</span>
            </div>
          )}
        </div>

        {/* 우측 텍스트 영역 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          padding: '60px 60px 60px 20px',
          gap: '0px',
        }}>
          {/* LP 뱃지 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
          }}>
            <div style={{
              background: 'rgba(139,92,246,0.2)',
              border: '1px solid rgba(139,92,246,0.5)',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '14px',
              color: '#a78bfa',
              fontWeight: 600,
              display: 'flex',
            }}>
              LP 레코드
            </div>
          </div>

          {/* 앨범 제목 */}
          <div style={{
            fontSize: title.length > 15 ? '42px' : '52px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: '16px',
            display: 'flex',
            flexWrap: 'wrap',
          }}>
            {title}
          </div>

          {/* 아티스트 */}
          {artist && (
            <div style={{
              fontSize: '26px',
              color: '#9ca3af',
              fontWeight: 500,
              marginBottom: '32px',
              display: 'flex',
            }}>
              {artist}
            </div>
          )}

          {/* 가격 */}
          {formattedPrice && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '32px',
            }}>
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: 500,
                letterSpacing: '0.05em',
                display: 'flex',
              }}>
                최저가
              </div>
              <div style={{
                fontSize: '56px',
                fontWeight: 800,
                color: '#4ade80',
                lineHeight: 1,
                display: 'flex',
              }}>
                {formattedPrice}
              </div>
            </div>
          )}

          {/* 설명 */}
          <div style={{
            fontSize: '16px',
            color: '#6b7280',
            display: 'flex',
            marginBottom: '0px',
          }}>
            네이버 · 알라딘 · YES24 · 교보문고 · 번개장터
          </div>
        </div>

        {/* 하단 브랜딩 */}
        <div style={{
          position: 'absolute',
          bottom: '28px',
          right: '52px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            fontSize: '18px',
            color: '#4b5563',
            fontWeight: 600,
            display: 'flex',
          }}>
            it's my turn
          </div>
          <div style={{
            fontSize: '18px',
            color: '#374151',
            display: 'flex',
          }}>
            · itsmyturn.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
