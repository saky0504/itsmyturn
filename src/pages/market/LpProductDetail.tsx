import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
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
import { useOnDemandPriceSearch } from '../../hooks/useOnDemandPriceSearch';

export function LpProductDetail() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { product, isLoading, refetch } = useSupabaseAlbum(productId);
  const { searchPrices, isLoading: isSearchingPrice } = useOnDemandPriceSearch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasAutoSearched = useRef(false); // 자동 검색 중복 방지

  const sortedOffers = useMemo(() => {
    if (!product) return [];

    // Deduplication logic: Keep first occurrence of unique (Vendor + Price + URL)
    const uniqueMap = new Map();
    product.offers.forEach(offer => {
      // Create a unique key. If URL is same, it's definitely duplicate.
      // If Vendor + Price is same, user considers it duplicate too based on request.
      // Let's use Vendor + Price + Channel as key, or just URL if available.
      // To be safe and dedupe redundant rows:
      // Deduplicate strictly by Vendor + Price. 
      // If a vendor has multiple links for the same price, we only show the first one.
      const key = `${offer.vendorName}-${offer.basePrice}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, offer);
      }
    });

    return Array.from(uniqueMap.values()).sort(
      (a, b) => calculateOfferFinalPrice(a) - calculateOfferFinalPrice(b)
    );
  }, [product]);

  // 제품이 로드되면 자동으로 가격 검색
  useEffect(() => {
    if (!product || isLoading || hasAutoSearched.current) return;

    // offers가 없거나, 24시간 이상 오래된 경우 자동 검색
    const shouldAutoSearch = (() => {
      if (!product.offers || product.offers.length === 0) {
        return true; // offers가 없으면 검색
      }

      // 가장 최근에 확인된 offer의 날짜 확인
      const lastChecked = product.offers
        .map(o => o.lastChecked ? new Date(o.lastChecked).getTime() : 0)
        .sort((a, b) => b - a)[0];

      if (!lastChecked) {
        return true; // 날짜 정보가 없으면 검색
      }

      // 24시간 이상 지났으면 새로 검색
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return lastChecked < oneDayAgo;
    })();

    if (shouldAutoSearch) {
      hasAutoSearched.current = true;
      setIsRefreshing(true);
      
      searchPrices({
        productId: product.id,
        artist: product.artist,
        title: product.title,
        ean: product.barcode,
        discogsId: product.discogsId,
        forceRefresh: false, // 캐시된 데이터가 있으면 사용
      })
        .then((result) => {
          if (result) {
            // 검색 성공 시 제품 정보 다시 불러오기
            refetch();
          }
        })
        .catch((err) => {
          console.error('자동 가격 검색 실패:', err);
          console.error('자동 가격 검색 실패 상세:', {
            productId: product.id,
            artist: product.artist,
            title: product.title,
            error: err
          });
        })
        .finally(() => {
          setIsRefreshing(false);
        });
    }
  }, [product, isLoading, searchPrices, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="rounded-xl bg-card p-10 shadow-sm border border-border text-center space-y-4 max-w-md w-full">
          <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">상품을 찾을 수 없습니다</h1>
            <p className="text-muted-foreground text-sm">
              URL을 다시 확인하거나 리스트 페이지에서 다시 선택해 주세요.
            </p>
          </div>
          <Button asChild className="rounded-xl w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/market">LP 가격 비교 홈으로 이동</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
        {/* 마켓으로 돌아가기 버튼 */}
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/market');
            }
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>마켓으로 돌아가기</span>
        </button>

        {/* 헤더 섹션 */}
        <header className="space-y-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* LP 이미지 */}
            <div className="flex-shrink-0 w-full md:w-80 lg:w-96 mx-auto md:mx-0">
              <div className="aspect-square rounded-xl overflow-hidden bg-muted shadow-sm border border-border/50">
                <img
                  src={product.cover || '/images/DJ_duic.jpg'}
                  alt={product.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
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
            <div className="flex-1 flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                {product.discogsId && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/50">
                    Discogs #{product.discogsId}
                  </span>
                )}
                {product.barcode && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/50">
                    {/^[0-9\s-]+$/.test(product.barcode) ? 'EAN ' : ''}{product.barcode}
                  </span>
                )}
                {product.category && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    {product.category.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight tracking-tight">{product.title}</h1>
                {product.artist && (
                  <div className="text-lg font-medium text-muted-foreground">
                    {product.artist}
                  </div>
                )}
              </div>

              {product.summary && (
                <div className="prose prose-sm text-muted-foreground max-w-none leading-relaxed border-t border-border pt-4 mt-2">
                  {product.summary}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 가격 비교 섹션 */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                가격 비교
                <span className="text-sm font-normal text-muted-foreground ml-1">({sortedOffers.length}개 판매처)</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                배송비 정책, 쿠폰 등을 고려한 실질적인 구매 혜택을 비교해보세요.
              </p>
            </div>
            <Button
              onClick={async () => {
                if (!product) return;
                setIsRefreshing(true);
                try {
                  const result = await searchPrices({
                    productId: product.id,
                    artist: product.artist,
                    title: product.title,
                    ean: product.barcode,
                    discogsId: product.discogsId,
                    forceRefresh: true,
                  });
                  if (result) {
                    // 검색 성공 시 제품 정보 다시 불러오기
                    await refetch();
                  }
                } catch (err) {
                  console.error('가격 검색 실패:', err);
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isSearchingPrice || isRefreshing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${(isSearchingPrice || isRefreshing) ? 'animate-spin' : ''}`} />
              {(isSearchingPrice || isRefreshing) ? '검색 중...' : '가격 새로고침'}
            </Button>
          </div>

          {sortedOffers.length > 0 ? (
            <>
              {/* 데스크탑 테이블 */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm text-foreground">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-6 py-4 text-left">판매처</th>
                      <th className="px-6 py-4 text-left">채널</th>
                      <th className="px-6 py-4 text-right">기준가</th>
                      <th className="px-6 py-4 text-left">배송정책</th>
                      <th className="px-6 py-4 text-right">최종 혜택가</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {sortedOffers.map((offer) => {
                      const channel = getChannelById(offer.channelId);
                      const finalPrice = calculateOfferFinalPrice(offer);
                      const affiliateUrl = buildAffiliateUrl(offer);
                      return (
                        <tr
                          key={offer.id}
                          className="hover:bg-muted/30 transition-colors duration-200 cursor-pointer group"
                          onClick={() => window.open(affiliateUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{offer.vendorName}</span>
                              {offer.notes && <span className="text-xs text-muted-foreground mt-1">{offer.notes}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/market/channels/${offer.channelId}`;
                              }}
                            >
                              {channel?.label || offer.channelId}
                              <ArrowUpRight className="w-3 h-3" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm text-muted-foreground line-through decoration-border mr-2 opacity-70">
                              {offer.basePrice > finalPrice ? formatCurrency(offer.basePrice) : ''}
                            </span>
                            <span className="text-sm text-foreground font-medium">
                              {offer.basePrice > finalPrice ? '' : formatCurrency(offer.basePrice)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-foreground">
                                {offer.shippingFee ? `배송비 ${formatCurrency(offer.shippingFee)}` : '무료배송'}
                              </div>
                              {offer.shippingPolicy && (
                                <div className="text-[11px] text-muted-foreground">{offer.shippingPolicy}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-lg font-bold text-primary">
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
              <div className="md:hidden space-y-4">
                {sortedOffers.map((offer) => {
                  const channel = getChannelById(offer.channelId);
                  const finalPrice = calculateOfferFinalPrice(offer);
                  const affiliateUrl = buildAffiliateUrl(offer);
                  return (
                    <div
                      key={offer.id}
                      className="rounded-xl border border-border bg-card p-5 space-y-4 cursor-pointer active:scale-[0.99] transition-transform duration-200 shadow-sm"
                      onClick={() => window.open(affiliateUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-foreground">{offer.vendorName}</div>
                          {offer.notes && (
                            <div className="text-xs text-muted-foreground mt-1">{offer.notes}</div>
                          )}
                        </div>
                        {offer.badge && (
                          <span
                            className={`flex-shrink-0 inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${offer.badge === 'lowest' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
                              }`}
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
            <div className="text-center py-12 space-y-4">
              <p className="text-sm text-muted-foreground">
                {isSearchingPrice || isRefreshing 
                  ? '가격 검색 중...' 
                  : '현재 가격 정보가 없습니다.'}
              </p>
              {(isSearchingPrice || isRefreshing) && (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              )}
              <Button
                onClick={async () => {
                  if (!product) return;
                  setIsRefreshing(true);
                  try {
                    const result = await searchPrices({
                      productId: product.id,
                      artist: product.artist,
                      title: product.title,
                      ean: product.barcode,
                      discogsId: product.discogsId,
                      forceRefresh: true,
                    });
                    if (result) {
                      await refetch();
                    }
                  } catch (err) {
                    console.error('가격 검색 실패:', err);
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isSearchingPrice || isRefreshing}
                variant="default"
                className="flex items-center gap-2 mx-auto"
              >
                <RefreshCw className={`w-4 h-4 ${(isSearchingPrice || isRefreshing) ? 'animate-spin' : ''}`} />
                {(isSearchingPrice || isRefreshing) ? '검색 중...' : '가격 검색하기'}
              </Button>
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


