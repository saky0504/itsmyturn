import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { MarketHeader } from '../../components/market/MarketHeader';
import { LpComments } from '../../components/market/LpComments';
import { ShareButton } from '../../components/market/ShareButton';
import { LpRatingDisc } from '../../components/market/LpRatingDisc';
import {
  buildAffiliateUrl,
  calculateOfferFinalPrice,
  formatCurrency,
} from '../../data/lpMarket';
import { useSupabaseAlbum } from '../../hooks/useSupabaseAlbum';
import { useOnDemandPriceSearch } from '../../hooks/useOnDemandPriceSearch';

function SpinningLP({ size = 68 }: { size?: number }) {
  return (
    <img
      src="/images/back.png"
      alt="로딩 중"
      className="animate-spin"
      style={{ width: size, height: size, animationDuration: '2s' }}
    />
  );
}

export function LpProductDetail() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { product, isLoading, refetch } = useSupabaseAlbum(productId);
  const { searchPrices, isLoading: isSearchingPrice } = useOnDemandPriceSearch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasAutoSearched = useRef(false); // 자동 검색 중복 방지

  const handleManualRefresh = async () => {
    if (!product || isRefreshing || isSearchingPrice) return;
    setIsRefreshing(true);
    const vendors = ['naver', 'aladin', 'yes24', 'kyobo', 'gimbab', 'bunjang'];
    for (const vendor of vendors) {
      try {
        await searchPrices({
          productId: product.id,
          artist: product.artist,
          title: product.title,
          ean: product.barcode ?? undefined,
          discogsId: product.discogsId ?? undefined,
          forceRefresh: true,
          vendor,
        });
        await refetch();
      } catch (err) {
        console.error(`[${vendor}] 가격 재검색 실패:`, err);
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    setIsRefreshing(false);
  };

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

      const vendors = ['naver', 'aladin', 'yes24', 'kyobo', 'gimbab', 'bunjang'];

      const fetchSequentially = async () => {
        for (const vendor of vendors) {
          try {
            const result = await searchPrices({
              productId: product.id,
              artist: product.artist,
              title: product.title,
              ean: product.barcode ?? undefined,
              discogsId: product.discogsId ?? undefined,
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
        <SpinningLP />
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

  const bestPrice = sortedOffers[0] ? calculateOfferFinalPrice(sortedOffers[0]) : null;
  const metaTitle = product.artist
    ? `${product.title} - ${product.artist} | it's my turn`
    : `${product.title} | it's my turn`;
  const metaDescription = bestPrice
    ? `${product.title}${product.artist ? ` by ${product.artist}` : ''} LP 최저가 ${formatCurrency(bestPrice)}. 국내 주요 쇼핑몰 가격 비교.`
    : `${product.title}${product.artist ? ` by ${product.artist}` : ''} LP 가격 비교. 네이버, 알라딘, Yes24, 교보문고.`;
  const ogDescription = bestPrice
    ? `it's my turn 최저가 ${formatCurrency(bestPrice)}`
    : `it's my turn · LP 가격 비교`;


  const ogImageUrl = 'https://itsmyturn.app/og-image.jpg';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={product.artist ? `${product.artist} - ${product.title}` : product.title} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="product" />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogImageUrl} />
        {bestPrice && (
          <script type="application/ld+json">{JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.title,
            ...(product.artist && { brand: { '@type': 'Brand', name: product.artist } }),
            ...(product.cover && { image: product.cover }),
            ...(product.category && { category: product.category }),
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'KRW',
              lowPrice: bestPrice,
              offerCount: sortedOffers.length,
              availability: 'https://schema.org/InStock',
            },
          })}</script>
        )}
      </Helmet>
      <MarketHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/market');
              }
            }}
            className="inline-flex items-center justify-center h-8 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all duration-200 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <ShareButton
            title={metaTitle}
            text=""
            url={typeof window !== 'undefined' ? window.location.href.split('?')[0] : `https://itsmyturn.app/market/lp/${product.id}`}
          />
        </div>

        {/* 헤더 섹션 */}
        <header className="space-y-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* LP 이미지 + 별점 (좌측 컬럼) */}
            <div className="flex-shrink-0 w-full md:w-80 lg:w-96 mx-auto md:mx-0 space-y-4">
              <div className="aspect-square rounded-xl overflow-hidden bg-muted shadow-sm border border-border/50">
                <img
                  src={product.cover || '/images/DJ_duic.jpg'}
                  alt={product.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  loading="eager"
                  fetchPriority="high"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== `${window.location.origin}/images/DJ_duic.jpg`) {
                      target.src = '/images/DJ_duic.jpg';
                    }
                  }}
                />
              </div>
              <LpRatingDisc productId={product.id} />
            </div>

            {/* 제품 정보 */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const isAladin = typeof product.discogsId === 'string' && product.discogsId.startsWith('aladin-');
                  return (
                    <>
                      {!isAladin && product.discogsId && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground/80 border border-border/60">
                          Discogs #{product.discogsId}
                        </span>
                      )}
                      {!isAladin && product.barcode && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground/80 border border-border/60">
                          EAN {product.barcode}
                        </span>
                      )}
                      {product.category && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground/80 border border-border/60">
                          {product.category.toUpperCase()}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-[1.2]">{product.title}</h1>
                {product.artist && (
                  <div className="text-lg sm:text-xl font-medium text-muted-foreground/80">
                    {product.artist}
                  </div>
                )}
              </div>

              {product.summary && (
                <div className="text-sm text-foreground/70 leading-relaxed border-t border-border/60 pt-5 mt-1">
                  {product.summary}
                </div>
              )}

              {/* 트랙리스트 (앨범 정보 영역에 통합) */}
              {product.track_list && product.track_list.length > 0 && (
                <div className="mt-2 pt-5 border-t border-border/60 flex-1 flex flex-col min-h-0">
                  <h3 className="text-base font-semibold text-foreground mb-4 flex items-center justify-between">
                    <span>Tracklist</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground/80 border border-border/60">{product.track_list.length} tracks</span>
                  </h3>
                  <div className="max-h-[260px] overflow-y-auto pr-2 space-y-1">
                    {product.track_list.map((track, idx) => (
                      <div key={idx} className="flex flex-row items-center gap-4 text-sm py-2 px-3 rounded-md hover:bg-muted/40 transition-colors group">
                        <span className="w-6 text-xs text-muted-foreground/60 font-mono text-right shrink-0 group-hover:text-muted-foreground transition-colors">
                          {track.position || (idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="flex-1 text-foreground/90 font-medium leading-snug">{track.title}</span>
                        {track.duration && (
                          <span className="text-xs text-muted-foreground/60 font-mono shrink-0">{track.duration}</span>
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
          <div className="flex items-center justify-between border-b border-border pb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              가격 비교
              <span className="text-sm font-normal text-muted-foreground ml-1">({sortedOffers.length}개 판매처)</span>
            </h2>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isSearchingPrice}
              className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing || isSearchingPrice ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
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
                      <th className="px-6 py-4 text-right">배송비</th>
                      <th className="px-6 py-4 text-right">가격</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {sortedOffers.map((offer) => {
                      const finalPrice = calculateOfferFinalPrice(offer);
                      const affiliateUrl = buildAffiliateUrl(offer);

                      // 네이버 쇼핑인 경우 처리
                      const isNaver = offer.channelId === 'naver' || offer.channelId === 'naver-api' || offer.vendorName.includes('네이버');
                      const isBunjang = offer.channelId === 'bunjang';
                      const displayVendor = isNaver && offer.vendorName === '네이버 쇼핑' ? '상세조건 확인' : offer.vendorName;
                      const displaySubName = isNaver ? 'Naver Smartstore' : isBunjang ? '번개장터' : null;

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
                          <td className="px-6 py-4 text-right">
                            {offer.shippingFee > 0 ? (
                              <span className="text-sm text-foreground font-medium">
                                {formatCurrency(offer.shippingFee)}
                              </span>
                            ) : offer.shippingPolicy === '상세정보 확인' ? (
                              <span className="text-sm text-muted-foreground">
                                상세정보 확인
                              </span>
                            ) : (
                              <span className="text-sm text-foreground font-medium">
                                무료배송
                              </span>
                            )}
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
                  const isBunjang = offer.channelId === 'bunjang';
                  const displayVendor = isNaver && offer.vendorName === '네이버 쇼핑' ? '상세조건 확인' : offer.vendorName;
                  const displaySubName = isNaver ? 'Naver Smartstore' : isBunjang ? '번개장터' : null;

                  return (
                    <div
                      key={offer.id}
                      className={`rounded-xl border border-border bg-card p-4 space-y-3 cursor-pointer active:scale-[0.99] transition-transform duration-200 shadow-sm ${!offer.inStock ? 'opacity-60' : ''}`}
                      onClick={() => window.open(affiliateUrl, '_blank', 'noopener')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-base font-bold text-foreground leading-none">{displayVendor}</span>
                            {!offer.inStock && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground leading-none">품절</span>
                            )}
                            {offer.badge === 'used' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 leading-none">중고</span>
                            )}
                            {offer.badge === 'out-of-print' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 leading-none">절판</span>
                            )}
                          </div>
                          {displaySubName && (
                            <div className="text-xs text-muted-foreground mt-1.5">{displaySubName}</div>
                          )}

                        </div>
                        {offer.badge && offer.inStock && !['used', 'out-of-print'].includes(offer.badge) && (
                          <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${offer.badge === 'lowest' ? 'bg-red-50 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                            {offer.badge === 'lowest' ? '최저가' : offer.badge === 'fresh' ? '신규' : '단독'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-end justify-between pt-3 border-t border-border/60">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-muted-foreground mb-0.5">실구매가</span>
                          <span className="text-2xl font-bold text-foreground tracking-tight leading-none">{formatCurrency(finalPrice)}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground text-right">
                          {offer.shippingFee > 0 ? (
                            <>
                              <span>기준가 {formatCurrency(offer.basePrice)}</span>
                              <span>배송비 {formatCurrency(offer.shippingFee)}</span>
                            </>
                          ) : offer.shippingPolicy === '상세정보 확인' ? (
                            <span className="text-[10px] text-muted-foreground">배송비 상세정보 확인</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground/70 font-medium">무료배송</span>
                          )}
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
                  <SpinningLP size={86} />
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
    </div >
  );
}

export default LpProductDetail;


