import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { MarketHeader } from '../../components/market/MarketHeader';
import { LpComments } from '../../components/market/LpComments';
import {
  buildAffiliateUrl,
  calculateOfferFinalPrice,
  formatCurrency,
  getChannelById,
} from '../../data/lpMarket';
import { useSupabaseAlbum } from '../../hooks/useSupabaseAlbum';

export function LpProductDetail() {
  const { productId } = useParams();
  const { product, isLoading } = useSupabaseAlbum(productId);

  const sortedOffers = useMemo(() => {
    if (!product) return [];
    return [...product.offers].sort(
      (a, b) => calculateOfferFinalPrice(a) - calculateOfferFinalPrice(b)
    );
  }, [product]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
        {/* 마켓으로 돌아가기 버튼 */}
        <Link
          to="/market"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>마켓으로 돌아가기</span>
        </Link>

        <header className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* LP 이미지 */}
            <div className="flex-shrink-0 w-full md:w-80 lg:w-96 mx-auto md:mx-0">
              <div className="aspect-square rounded-xl overflow-hidden bg-muted shadow-lg">
                <img
                  src={product.cover || '/images/DJ_duic.jpg'}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== `${window.location.origin}/images/DJ_duic.jpg`) {
                      target.src = '/images/DJ_duic.jpg';
                    }
                  }}
                />
              </div>
            </div>

            {/* 제품 정보 */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {product.discogsId && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground">
                    Discogs #{product.discogsId}
                  </span>
                )}
                {product.barcode && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground">
                    EAN {product.barcode}
                  </span>
                )}
                {product.category && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground">
                    {product.category.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mt-2">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-[1.3]">{product.title}</h1>
                {product.artist && (
                  <span className="text-sm font-normal text-muted-foreground mt-2">· {product.artist}</span>
                )}
              </div>
              {product.summary && (
                <p className="text-sm font-normal text-muted-foreground max-w-3xl leading-[1.6] mt-3">{product.summary}</p>
              )}
            </div>
          </div>
        </header>

        {/* 가격 비교 섹션 */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">가격 비교</h2>
              <p className="text-xs font-normal text-muted-foreground mt-1">
                배송비 정책, 쿠폰, 카드 청구할인을 반영한 실결제 예상 금액
              </p>
            </div>
          </div>

          {sortedOffers.length > 0 ? (
            <>
              {/* 데스크탑 테이블 */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-muted/50">
                <table className="w-full text-sm text-foreground">
                  <thead className="bg-muted text-xs uppercase tracking-[0.05em] text-muted-foreground font-medium">
                    <tr>
                      <th className="px-4 py-2.5 text-left">판매처</th>
                      <th className="px-4 py-2.5 text-left">채널</th>
                      <th className="px-4 py-2.5 text-right">기준가</th>
                      <th className="px-4 py-2.5 text-left">배송비 / 정책</th>
                      <th className="px-4 py-2.5 text-right">실구매가</th>
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
                          className="border-t border-border bg-card hover:bg-muted/50 transition-colors duration-150 cursor-pointer"
                          onClick={() => window.open(affiliateUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">{offer.vendorName}</span>
                              {offer.notes && <span className="text-xs text-muted-foreground mt-0.5 font-normal">{offer.notes}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/market/channels/${offer.channelId}`;
                              }}
                            >
                              {channel?.label || offer.channelId}
                              <ArrowUpRight className="w-3 h-3" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-normal text-muted-foreground">
                              {formatCurrency(offer.basePrice)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-normal text-muted-foreground">
                              {(() => {
                                const policy = offer.shippingPolicy || '';
                                if (policy.includes('무료') && policy.includes('만원')) {
                                  // "5만원 이상 무료배송" 형식 추출
                                  const match = policy.match(/(\d+만원\s*이상)/);
                                  return match ? `${match[1]} 구매 시` : policy.split('/')[0].trim();
                                }
                                if (policy.includes('무료')) {
                                  return '';
                                }
                                return policy;
                              })()}
                            </div>
                            <div className="text-xs font-normal text-muted-foreground mt-0.5">
                              배송비 {offer.shippingFee ? formatCurrency(offer.shippingFee) : '무료'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-base sm:text-lg font-bold text-foreground">
                              {formatCurrency(finalPrice)}
                            </span>
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
                      className="rounded-xl border border-border bg-card p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors duration-150"
                      onClick={() => window.open(affiliateUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground text-sm">{offer.vendorName}</div>
                          {offer.notes && (
                            <div className="text-xs font-normal text-muted-foreground mt-0.5">{offer.notes}</div>
                          )}
                        </div>
                        {offer.badge && (
                          <span
                            className={`flex-shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground`}
                          >
                            {offer.badge === 'lowest' ? '최저가' : offer.badge === 'fresh' ? '신규' : '단독'}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-normal text-muted-foreground">채널</span>
                          <div
                            className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/market/channels/${offer.channelId}`;
                            }}
                          >
                            {channel?.label || offer.channelId}
                            <ArrowUpRight className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-normal text-muted-foreground">기준가</span>
                          <span className="text-sm font-normal text-muted-foreground">{formatCurrency(offer.basePrice)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-normal text-muted-foreground">배송비</span>
                          <span className="font-normal text-foreground">
                            {offer.shippingFee ? formatCurrency(offer.shippingFee) : '무료'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <div className="text-xs font-normal text-muted-foreground mb-1">{offer.shippingPolicy}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          <div className="text-xs text-muted-foreground font-normal">실구매가</div>
                          <div className="text-base font-bold text-foreground">{formatCurrency(finalPrice)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">현재 가격 정보가 없습니다.</p>
            </div>
          )}
        </section>

        {/* 댓글 섹션 */}
        <LpComments
          productId={product.id}
          productTitle={product.title}
          productArtist={product.artist}
        />
      </div>
    </div>
  );
}

export default LpProductDetail;


