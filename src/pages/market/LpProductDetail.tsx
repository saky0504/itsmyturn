import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { MarketHeader } from '../../components/market/MarketHeader';
import { LpComments } from '../../components/market/LpComments';
import {
  buildAffiliateUrl,
  calculateOfferFinalPrice,
  formatCurrency,
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

  // 제품이 로드되면 자동으로 스태거드(교차 지연) 가격 검색
  useEffect(() => {
    if (!product || isLoading || hasAutoSearched.current) return;

    // offers가 없거나, 24시간 이상 오래된 경우 자동 검색
    const shouldAutoSearch = (() => {
      if (!product.offers || product.offers.length === 0) {
        return true;
      }
      const lastChecked = product.offers
        .map(o => o.lastChecked ? new Date(o.lastChecked).getTime() : 0)
        .sort((a, b) => b - a)[0];
      if (!lastChecked) {
        return true;
      }
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return lastChecked < oneDayAgo;
    })();

    if (shouldAutoSearch) {
      hasAutoSearched.current = true;
      setIsRefreshing(true);

      const vendors = ['naver', 'aladin', 'yes24', 'kyobo', 'gimbab'];

      const fetchSequentially = async () => {
        for (const vendor of vendors) {
          try {
            const result = await searchPrices({
              productId: product.id,
              artist: product.artist,
              title: product.title,
              ean: product.barcode,
              discogsId: product.discogsId,
              forceRefresh: true, // Auto-fetch when stale should force refresh the cache
              vendor: vendor
            });
            if (result) {
              // 성공 시 DB에 바로 반영되므로 화면을 즉시 업데이트
              await refetch();
            }
          } catch (err) {
            console.error(`[${vendor}] 가격 검색 실패:`, err);
          }
          // API Ban 방지 및 서버 과부하 방지를 위한 1.5초 대기
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        setIsRefreshing(false);
      };

      fetchSequentially();
    }
  }, [product, isLoading, searchPrices, refetch]);

  if (isLoading && !product) {
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

              {/* 트랙리스트 (앨범 정보 영역에 통합) */}
              {product.track_list && product.track_list.length > 0 && (
                <div className="mt-2 pt-4 border-t border-border flex-1 flex flex-col min-h-0">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center justify-between">
                    <span>Tracklist</span>
                    <span className="font-normal text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded-full">{product.track_list.length} tracks</span>
                  </h3>
                  <div className="max-h-[240px] overflow-y-auto pr-2 space-y-0.5">
                    {product.track_list.map((track, idx) => (
                      <div key={idx} className="flex flex-row items-center gap-3 text-sm py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors group">
                        <span className="w-5 text-xs text-muted-foreground font-mono text-right shrink-0 group-hover:text-foreground transition-colors">
                          {track.position || (idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="flex-1 truncate text-foreground/90 font-medium">{track.title}</span>
                        {track.duration && (
                          <span className="text-xs text-muted-foreground font-mono shrink-0">{track.duration}</span>
                        )}
                      </div>
                    ))}
                  </div>
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
                {(isRefreshing || isSearchingPrice) && (
                  <div className="flex items-center gap-1.5 ml-3 bg-primary/10 px-2 py-1 rounded-full">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="text-xs font-medium text-primary">실시간 재검색 중...</span>
                  </div>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 break-keep">
                배송비 정책, 쿠폰 등을 고려한 실질적인 구매 혜택을 비교해보세요.
              </p>
            </div>

          </div>

          {sortedOffers.length > 0 ? (
            <>
              {/* 데스크탑 테이블 */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm text-foreground">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-6 py-4 text-left">판매처</th>
                      <th className="px-6 py-4 text-right">기준가</th>
                      <th className="px-6 py-4 text-left">배송정책</th>
                      <th className="px-6 py-4 text-right">최종 혜택가</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {sortedOffers.map((offer) => {
                      const finalPrice = calculateOfferFinalPrice(offer);
                      const affiliateUrl = buildAffiliateUrl(offer);

                      // 네이버 쇼핑인 경우 처리
                      const isNaver = offer.channelId === 'naver' || offer.channelId === 'naver-api' || offer.vendorName.includes('네이버');
                      const displayVendor = isNaver && offer.vendorName === '네이버 쇼핑' ? '상세조건 확인' : offer.vendorName;
                      const displaySubName = isNaver ? 'Naver Smartstore' : null;

                      return (
                        <tr
                          key={offer.id}
                          className={`hover:bg-muted/30 transition-colors duration-200 cursor-pointer group ${!offer.inStock ? 'opacity-50 grayscale' : ''}`}
                          onClick={() => window.open(affiliateUrl, '_blank', 'noopener')}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {displayVendor}
                                </span>
                                {displaySubName && (
                                  <span className="text-xs text-muted-foreground mt-0.5">{displaySubName}</span>
                                )}
                              </div>
                              {!offer.inStock && (
                                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-muted-foreground">
                                  품절
                                </span>
                              )}
                              {offer.badge === 'used' && (
                                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  중고
                                </span>
                              )}
                              {offer.badge === 'out-of-print' && (
                                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                  절판
                                </span>
                              )}
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
                              {offer.shippingPolicy && offer.shippingPolicy !== displayVendor && (
                                <div className="text-[11px] text-muted-foreground max-w-[200px] truncate" title={offer.shippingPolicy}>
                                  {offer.shippingPolicy}
                                </div>
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

              <div className="md:hidden space-y-4">
                {sortedOffers.map((offer) => {
                  const finalPrice = calculateOfferFinalPrice(offer);
                  const affiliateUrl = buildAffiliateUrl(offer);

                  // 네이버 쇼핑인 경우 처리
                  const isNaver = offer.channelId === 'naver' || offer.channelId === 'naver-api' || offer.vendorName.includes('네이버');
                  const displayVendor = isNaver && offer.vendorName === '네이버 쇼핑' ? '상세조건 확인' : offer.vendorName;
                  const displaySubName = isNaver ? 'Naver Smartstore' : null;

                  return (
                    <div
                      key={offer.id}
                      className={`rounded-xl border border-border bg-card p-5 space-y-4 cursor-pointer active:scale-[0.99] transition-transform duration-200 shadow-sm ${!offer.inStock ? 'opacity-60' : ''}`}
                      onClick={() => window.open(affiliateUrl, '_blank', 'noopener')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-foreground">
                            {displayVendor}
                            {!offer.inStock && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 align-middle">
                                품절
                              </span>
                            )}
                            {offer.badge === 'used' && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 align-middle">
                                중고
                              </span>
                            )}
                            {offer.badge === 'out-of-print' && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 align-middle">
                                절판
                              </span>
                            )}
                          </div>
                          {displaySubName && (
                            <div className="text-xs text-muted-foreground mt-1">{displaySubName}</div>
                          )}
                        </div>
                        {offer.badge && offer.inStock && !['used', 'out-of-print'].includes(offer.badge) && (
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
                          <span className="font-normal text-muted-foreground">기준가</span>
                          <span className="text-sm font-normal text-muted-foreground">{formatCurrency(offer.basePrice)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-normal text-muted-foreground">배송비</span>
                          <span className="font-normal text-foreground">
                            {offer.shippingFee ? formatCurrency(offer.shippingFee) : '무료'}
                          </span>
                        </div>
                        {offer.shippingPolicy && offer.shippingPolicy !== displayVendor && (
                          <div className="pt-2 border-t border-border">
                            <div className="text-xs font-normal text-muted-foreground mb-1">{offer.shippingPolicy}</div>
                          </div>
                        )}
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
            <div className="text-center py-16 space-y-4">
              {isSearchingPrice || isRefreshing ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground font-medium">가격 검색 중...</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">현재 등록된 판매 가격 정보가 없습니다.</p>
              )}
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


