import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Grid, List, Search, Loader2, X } from 'lucide-react';
import { MarketHeader } from '../../components/market/MarketHeader';
import {
  calculateOfferFinalPrice,
  formatCurrency,
  type LpProduct,
} from '../../data/lpMarket';
import { useSupabaseProducts } from '../../hooks/useSupabaseProducts';
import { getDailyLpRecommendations } from '../../lib/recommendation';
import { useIsMobile } from '../../../components/ui/use-mobile';

const getBestOffer = (offers: LpProduct['offers']) => {
  if (!offers?.length) return undefined;
  const inStockOffers = offers.filter((offer) => offer.inStock);
  const offersToUse = inStockOffers.length > 0 ? inStockOffers : offers;
  return [...offersToUse]
    .sort((a, b) => calculateOfferFinalPrice(a) - calculateOfferFinalPrice(b))[0];
};

interface ProductCardProps {
  product: LpProduct;
  variant?: 'default' | 'featured' | 'compact' | 'list';
}

function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  const bestOffer = getBestOffer(product.offers);
  const finalPrice = bestOffer ? calculateOfferFinalPrice(bestOffer) : null;

  if (variant === 'list') {
    return (
      <Link
        to={`/market/lp/${product.id}`}
        className="group relative flex border border-border bg-card hover:border-border/80 hover:shadow-md transition-all duration-200 overflow-hidden rounded-xl"
      >
        {bestOffer?.badge && bestOffer.badge !== 'exclusive' && (
          <div className="absolute top-2 left-2 z-10">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm ${bestOffer.badge === 'lowest'
                ? 'bg-emerald-500 text-white'
                : 'bg-blue-500 text-white'
                }`}
            >
              {bestOffer.badge === 'lowest' ? 'BEST' : 'NEW'}
            </span>
          </div>
        )}
        {/* 썸네일: Today's Pick featured 카드와 동일한 비율로 축소 */}
        <div className="flex-shrink-0 w-36 h-36 sm:w-44 sm:h-44 overflow-hidden bg-muted rounded-tr-lg rounded-bl-lg rounded-br-lg">
          <img
            src={product.cover || '/images/DJ_duic.jpg'}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== `${window.location.origin}/images/DJ_duic.jpg`) {
                target.src = '/images/DJ_duic.jpg';
              }
            }}
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2 p-3 sm:p-4">
          <div className="space-y-1">
            <h3 className="text-[15px] sm:text-[17px] font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
              {product.title}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{product.artist}</p>
          </div>

          {(() => {
            const tags = [
              product.category?.trim(),
            ].filter(Boolean);

            if (tags.length === 0) return null;

            return (
              <div className="flex flex-wrap items-center gap-1">
                {product.category?.trim() && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] bg-muted text-muted-foreground">
                    {product.category.trim()}
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex items-center justify-between mt-auto">
            {finalPrice ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-lg sm:text-xl font-bold text-primary">
                  {formatCurrency(finalPrice)}
                </span>
                {bestOffer && (
                  <span className="text-[11px] text-muted-foreground/60">{bestOffer.vendorName}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Price info not available</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'featured') {
    return (
      <Link
        to={`/market/lp/${product.id}`}
        className="group relative w-full block"
      >
        <div className="relative aspect-square overflow-hidden bg-slate-100 rounded-xl mb-3">
          <img
            src={product.cover || '/images/DJ_duic.jpg'}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 mix-blend-multiply"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== `${window.location.origin}/images/DJ_duic.jpg`) {
                target.src = '/images/DJ_duic.jpg';
              }
            }}
          />
          {finalPrice && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 pt-8">
              <span className="text-white text-lg sm:text-xl font-bold drop-shadow-sm">
                {formatCurrency(finalPrice)}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <h3 className="text-[15px] font-bold text-slate-900 line-clamp-1 group-hover:text-black leading-tight">
            {product.title}
          </h3>
          <p className="text-[12px] font-medium text-gray-500 line-clamp-1">{product.artist}</p>
        </div>
      </Link>
    );
  }


  // Grid 카드: featured와 동일한 비율/스타일로 맞춤
  return (
    <Link
      to={`/market/lp/${product.id}`}
      className="group block rounded-xl overflow-hidden hover:opacity-90 transition-opacity duration-200"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100 rounded-xl mb-2">
        <img
          src={product.cover || '/images/DJ_duic.jpg'}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== `${window.location.origin}/images/DJ_duic.jpg`) {
              target.src = '/images/DJ_duic.jpg';
            }
          }}
        />
        {finalPrice && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-4">
            <span className="text-white text-sm font-bold">{formatCurrency(finalPrice)}</span>
          </div>
        )}
      </div>
      <div className="space-y-0.5 px-0.5">
        <h3 className="text-[14px] font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors leading-tight">
          {product.title}
        </h3>
        <p className="text-[12px] font-medium text-muted-foreground line-clamp-1">{product.artist}</p>
      </div>
    </Link>
  );
}

function FeaturedCarousel({ products }: { products: LpProduct[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6"
      >
        {products.map((product) => (
          <div key={product.id} className="w-full">
            <ProductCard product={product} variant="featured" />
          </div>
        ))}
      </div>
    </div>
  );
}

const STORAGE_KEY = 'itsmyturn_lp_market_state';

export function LpHome() {
  // 초기 상태를 세션 스토리지에서 복원
  const getInitialState = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { query: '' };
    } catch {
      return { query: '' };
    }
  };

  const initialState = getInitialState();

  const [searchQuery, setSearchQuery] = useState<string>(initialState.query || '');
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialState.query || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // 상태 변경 시 스토리지 저장
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      query: searchQuery,
    }));
  }, [searchQuery]);

  // 디바운스 처리
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Supabase 데이터 훅 사용
  const { products, allProducts, totalCount, hasMore, isLoading, isLoadingMore, error, loadMore } = useSupabaseProducts(debouncedQuery);
  const isMobile = useIsMobile();

  // IntersectionObserver sentinel ref
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const featuredProducts = useMemo(() => {
    if (!debouncedQuery && allProducts.length > 0) {
      return getDailyLpRecommendations(allProducts, 5);
    }
    return [];
  }, [debouncedQuery, allProducts]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
        <main>
          <div className="mb-10">
            <form onSubmit={(e) => e.preventDefault()} className="w-full">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Artist, Album Search"
                  className="w-full pl-12 pr-12 pt-4 pb-2 text-base bg-transparent border-b border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors rounded-none"
                />
                {searchQuery && !isLoading && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
                {isLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </form>
          </div>

          {!debouncedQuery && featuredProducts.length > 0 && !isLoading && (
            <section className="mb-12">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Today's Picks</h2>
                <p className="text-sm text-muted-foreground mt-1">Daily curated selection just for you</p>
              </div>
              <FeaturedCarousel products={isMobile ? featuredProducts.slice(0, 4) : featuredProducts} />
            </section>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 flex items-center gap-2.5">
                <h2 className="text-2xl font-bold text-foreground">
                  {debouncedQuery ? `Search results` : 'All albums'}
                </h2>
                {!isLoading && totalCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground tabular-nums">
                    {totalCount.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'grid'
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                    }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'list'
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                    }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="text-center py-16 text-blue-600 font-bold">
              <p>An error occurred while loading data.</p>
              <p className="text-sm mt-2">{error.message}</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-20">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Data Loading...</p>
            </div>
          ) : products.length > 0 ? (
            <>
              {viewMode === 'list' ? (
                <div className="space-y-3">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variant="list"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                    />
                  ))}
                </div>
              )}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4" />

              {/* Loading more indicator */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* End of list */}
              {!hasMore && !isLoadingMore && totalCount > 20 && (
                <div className="text-center py-8 text-sm text-muted-foreground/60">
                  — {totalCount.toLocaleString()}개 전체 표시됨 —
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No search results</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
