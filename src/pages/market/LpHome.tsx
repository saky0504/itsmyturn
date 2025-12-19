import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Grid, List, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MarketHeader } from '../../components/market/MarketHeader';
import {
  calculateOfferFinalPrice,
  formatCurrency,
  type LpProduct,
} from '../../data/lpMarket';
import { useSupabaseProducts } from '../../hooks/useSupabaseProducts';
import { getDailyLpRecommendations } from '../../lib/recommendation';

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
        <div className="flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 overflow-hidden bg-muted rounded-tr-lg rounded-bl-lg rounded-br-lg">
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
        <div className="flex-1 min-w-0 flex flex-col gap-3 p-4">
          <div className="space-y-1.5">
            <h3 className="text-[18px] font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
              {product.title}
            </h3>
            <p className="text-sm font-medium text-muted-foreground">{product.artist}</p>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 hidden sm:block leading-relaxed">
            {product.summary}
          </p>

          {(() => {
            const tags = [
              product.category?.trim(),
              product.edition?.trim(),
              product.country?.trim(),
            ].filter(Boolean);

            if (tags.length === 0) return null;

            return (
              <div className="flex flex-wrap items-center gap-1.5">
                {product.category?.trim() && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground">
                    {product.category.trim()}
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex items-center justify-between mt-auto">
            {finalPrice ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(finalPrice)}
                </span>
                {bestOffer && (
                  <span className="text-[11px] text-muted-foreground/60">{bestOffer.vendorName}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
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
        <div className="relative aspect-square overflow-hidden bg-slate-100 rounded-[24px] mb-3">
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
          <div
            role="button"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/70 backdrop-blur-sm hover:bg-white transition-colors z-10 shadow-sm cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Wishlist logic here
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-900"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-[17px] font-bold text-slate-900 line-clamp-1 group-hover:text-black leading-tight">
            {product.title}
          </h3>
          <p className="text-[13px] font-medium text-gray-500 line-clamp-1">{product.artist}</p>
        </div>
      </Link>
    );
  }


  return (
    <Link
      to={`/market/lp/${product.id}`}
      className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 hover:shadow-md transition-all duration-200"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
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
      <div className="p-4 space-y-1.5">
        <h3 className="text-[18px] font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight min-h-[2.5rem]">
          {product.title}
        </h3>
        <p className="text-sm font-medium text-muted-foreground line-clamp-1">{product.artist}</p>
        {finalPrice ? (
          <div className="flex flex-col gap-0.5 pt-1">
            <span className="text-xl font-bold text-primary">
              {formatCurrency(finalPrice)}
            </span>
            {bestOffer && (
              <span className="text-[11px] text-muted-foreground/60 truncate">{bestOffer.vendorName}</span>
            )}
          </div>
        ) : null}
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

export function LpHome() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 디바운스 처리
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const lastStablePageRef = useRef(1);

  // 1. 검색어가 없을 때만 현재 페이지 위치를 기억
  useEffect(() => {
    if (!debouncedQuery) {
      lastStablePageRef.current = currentPage;
    }
  }, [currentPage, debouncedQuery]);

  // 2. 검색어 변경 시 페이지 전환 로직
  useEffect(() => {
    if (debouncedQuery) {
      // 검색 시작 시 1페이지로
      setCurrentPage(1);
    } else {
      // 검색 취소 시 이전 페이지로 복귀
      setCurrentPage(lastStablePageRef.current);
    }
  }, [debouncedQuery]);

  // Supabase 데이터 훅 사용
  const { products, allProducts, totalCount, isLoading, error } = useSupabaseProducts(debouncedQuery, currentPage, itemsPerPage);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const featuredProducts = useMemo(() => {
    // 검색어가 없을 때만 "오늘의 추천 앨범" 5개를 표시 (Daily Fixed)
    if (!debouncedQuery && allProducts.length > 0) {
      return getDailyLpRecommendations(allProducts, 5);
    }
    return [];
  }, [debouncedQuery, allProducts]);

  // 검색어 입력 핸들러
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
                  className="w-full pl-12 pr-6 pt-4 pb-2 text-base bg-transparent border-b border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors rounded-none"
                />
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
                <h2 className="text-2xl font-bold text-foreground">Today's Picks 🎵</h2>
                <p className="text-sm text-muted-foreground mt-1">Daily curated selection just for you</p>
              </div>
              <FeaturedCarousel products={featuredProducts} />
            </section>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground">
                  {debouncedQuery ? `Search results` : 'All albums'}
                </h2>
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
                <div className="space-y-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} variant="list" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* 페이지 번호 표시 (단순화: 현재 페이지 주변만 등 복잡한 로직 제외하고 전체 표시 혹은 일부) */}
                  <span className="text-sm font-medium text-muted-foreground mx-2">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    {isLoading ? 'Loading...' : `Total ${totalCount}`}
                  </p>
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
