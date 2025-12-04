import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { MarketHeader } from '../../components/market/MarketHeader';
import {
  buildAffiliateUrl,
  calculateOfferFinalPrice,
  formatCurrency,
  getChannelById,
} from '../../data/lpMarket';
import { useLpProducts } from '../../hooks/useLpProducts';

export function LpProductDetail() {
  const { productId } = useParams();
  const { products } = useLpProducts();
  const product = products.find((item) => item.id === productId);

  const sortedOffers = useMemo(() => {
    if (!product) return [];
    return [...product.offers].sort(
      (a, b) => calculateOfferFinalPrice(a) - calculateOfferFinalPrice(b)
    );
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="rounded-3xl bg-card p-10 shadow-xl text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl text-foreground">상품을 찾을 수 없습니다</h1>
            <p className="text-muted-foreground text-sm">
              URL을 다시 확인하거나 리스트 페이지에서 다시 선택해 주세요.
            </p>
          </div>
          <Button asChild className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/market">LP 가격 비교 홈으로 이동</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
        <header className="rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.08)] p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* LP 이미지 */}
            <div className="flex-shrink-0 w-full md:w-64 lg:w-80 mx-auto md:mx-0">
              <div className="aspect-square rounded-xl overflow-hidden bg-muted shadow-lg">
                <img
                  src={product.cover}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
            
            {/* 제품 정보 */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-full border border-border px-3 py-1">
                  Discogs #{product.discogsId}
                </span>
                <span className="rounded-full border border-border px-3 py-1">
                  EAN {product.barcode}
                </span>
                <span className="rounded-full border border-border px-3 py-1">
                  {product.category.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl text-foreground leading-tight">{product.title}</h1>
                <span className="text-base sm:text-lg text-muted-foreground">· {product.artist}</span>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base max-w-3xl">{product.summary}</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">가격 비교 · 배송비 포함</h2>
            <p className="text-sm text-muted-foreground mt-1">
              배송비 정책, 쿠폰, 카드 청구할인을 반영한 실결제 예상 금액
            </p>
          </div>

          {/* 데스크탑 테이블 */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm text-foreground">
              <thead className="bg-muted text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">판매처</th>
                  <th className="px-5 py-3 text-left">채널</th>
                  <th className="px-5 py-3 text-left">기준가</th>
                  <th className="px-5 py-3 text-left">배송비 / 정책</th>
                  <th className="px-5 py-3 text-left">실구매가</th>
                  <th className="px-5 py-3 text-right">구매</th>
                </tr>
              </thead>
              <tbody>
                {sortedOffers.map((offer) => {
                  const channel = getChannelById(offer.channelId);
                  const finalPrice = calculateOfferFinalPrice(offer);
                  const affiliateUrl = buildAffiliateUrl(offer);
                  return (
                    <tr
                      key={offer.id}
                      className="border-t border-border bg-card hover:bg-accent transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{offer.vendorName}</span>
                          {offer.notes && <span className="text-xs text-muted-foreground">{offer.notes}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          to={`/market/channels/${offer.channelId}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                        >
                          {channel?.label || offer.channelId}
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="px-5 py-4">{formatCurrency(offer.basePrice)}</td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-muted-foreground">{offer.shippingPolicy}</div>
                        <div className="text-xs text-muted-foreground">
                          배송비 {offer.shippingFee ? formatCurrency(offer.shippingFee) : '무료'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-lg font-semibold text-foreground">
                        {formatCurrency(finalPrice)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <a
                          href={affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                        >
                          파트너 링크
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 리스트 */}
          <div className="md:hidden space-y-3">
            {sortedOffers.map((offer) => {
              const channel = getChannelById(offer.channelId);
              const finalPrice = calculateOfferFinalPrice(offer);
              const affiliateUrl = buildAffiliateUrl(offer);
              return (
                <div
                  key={offer.id}
                  className="rounded-xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground text-sm">{offer.vendorName}</div>
                      {offer.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5">{offer.notes}</div>
                      )}
                    </div>
                    {offer.badge && (
                      <span
                        className={`flex-shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground`}
                      >
                        {offer.badge === 'lowest' ? '최저가' : offer.badge === 'fresh' ? '신규' : '단독'}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">채널</span>
                      <Link
                        to={`/market/channels/${offer.channelId}`}
                        className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
                      >
                        {channel?.label || offer.channelId}
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">기준가</span>
                      <span className="text-foreground">{formatCurrency(offer.basePrice)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">배송비</span>
                      <span className="text-foreground">
                        {offer.shippingFee ? formatCurrency(offer.shippingFee) : '무료'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-1">{offer.shippingPolicy}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <div className="text-xs text-muted-foreground">실구매가</div>
                      <div className="text-lg font-bold text-foreground">{formatCurrency(finalPrice)}</div>
                    </div>
                    <a
                      href={affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      구매하기
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default LpProductDetail;


