import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Grid, List, Search } from 'lucide-react';
import { MarketHeader } from '../../components/market/MarketHeader';
import {
  calculateOfferFinalPrice,
  formatCurrency,
  type LpProduct,
} from '../../data/lpMarket';
import { useLpProducts } from '../../hooks/useLpProducts';
import { useRef, useEffect } from 'react';

const getBestOffer = (offers: LpProduct['offers']) => {
  if (!offers?.length) return undefined;
  return [...offers]
    .filter((offer) => offer.inStock)
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
        className="group flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-border/80 hover:shadow-md transition-all duration-200"
      >
        <div className="flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden bg-muted">
          <img
            src={product.cover}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {bestOffer?.badge && (
                <span
                  className={`flex-shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                    bestOffer.badge === 'lowest'
                      ? 'bg-muted text-muted-foreground'
                      : bestOffer.badge === 'fresh'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {bestOffer.badge === 'lowest' ? '최저가' : bestOffer.badge === 'fresh' ? '신규' : '단독'}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                  {product.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{product.artist}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 hidden sm:block">
              {product.summary}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{product.category}</span>
              <span>·</span>
              <span>{product.edition}</span>
              <span>·</span>
              <span>{product.country}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            {finalPrice ? (
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold text-foreground">
                  {formatCurrency(finalPrice)}
                </span>
                {bestOffer && (
                  <span className="text-sm text-muted-foreground">{bestOffer.vendorName}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">재고 없음</p>
            )}
            {product.offers.length > 1 && (
              <span className="text-xs text-primary font-medium">
                {product.offers.length}개 판매처
              </span>
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
        className="group relative flex-shrink-0 w-[280px] sm:w-[320px] rounded-2xl overflow-hidden bg-card border border-border hover:border-border/80 hover:shadow-lg transition-all duration-200"
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={product.cover}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {bestOffer?.badge && (
            <div className="absolute top-2 right-2">
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                  bestOffer.badge === 'lowest'
                    ? 'bg-emerald-500 text-white'
                    : bestOffer.badge === 'fresh'
                    ? 'bg-blue-500 text-white'
                    : 'bg-purple-500 text-white'
                }`}
              >
                {bestOffer.badge === 'lowest' ? '최저가' : bestOffer.badge === 'fresh' ? '신규' : '단독'}
              </span>
            </div>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          <h3 className="text-base font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
            {product.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-1">{product.artist}</p>
          {finalPrice ? (
            <div className="flex items-baseline gap-1.5 pt-1">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(finalPrice)}
              </span>
              {bestOffer && (
                <span className="text-xs text-muted-foreground">{bestOffer.vendorName}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pt-1">재고 없음</p>
          )}
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
          src={product.cover}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {bestOffer?.badge && (
          <div className="absolute top-2 right-2">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                bestOffer.badge === 'lowest'
                  ? 'bg-emerald-500 text-white'
                  : bestOffer.badge === 'fresh'
                  ? 'bg-blue-500 text-white'
                  : 'bg-purple-500 text-white'
              }`}
            >
              {bestOffer.badge === 'lowest' ? '최저가' : bestOffer.badge === 'fresh' ? '신규' : '단독'}
            </span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight min-h-[2.5rem]">
          {product.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{product.artist}</p>
        {finalPrice ? (
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-base font-bold text-foreground">
              {formatCurrency(finalPrice)}
            </span>
            {bestOffer && (
              <span className="text-xs text-muted-foreground truncate ml-2">{bestOffer.vendorName}</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 pt-1">재고 없음</p>
        )}
      </div>
    </Link>
  );
}

function FeaturedCarousel({ products }: { products: LpProduct[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScroll);
      return () => scrollElement.removeEventListener('scroll', checkScroll);
    }
  }, [products]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="이전 슬라이드"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} variant="featured" />
        ))}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors"
          aria-label="다음 슬라이드"
        >
          <ChevronRight className="w-5 h-5 text-slate-700" />
        </button>
      )}
    </div>
  );
}

export function LpHome() {
  const { products } = useLpProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const featuredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const offer = getBestOffer(p.offers);
        return offer && (offer.badge === 'lowest' || offer.badge === 'fresh');
      })
      .slice(0, 10);
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // 검색어 적용
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.title.toLowerCase().includes(query) ||
          product.artist.toLowerCase().includes(query) ||
          product.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // 가격순 정렬
    return [...filtered].sort((a, b) => {
      const priceA = getBestOffer(a.offers);
      const priceB = getBestOffer(b.offers);
      if (!priceA && !priceB) return 0;
      if (!priceA) return 1;
      if (!priceB) return -1;
      return calculateOfferFinalPrice(priceA) - calculateOfferFinalPrice(priceB);
    });
  }, [products, searchQuery]);


  return (
    <div className="min-h-screen bg-background">
      <MarketHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
        {/* 메인 컨텐츠 */}
        <main>
            {/* 검색창 */}
            <div className="mb-6">
              <form onSubmit={(e) => e.preventDefault()} className="max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="아티스트, 앨범명, 태그로 검색..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                </div>
              </form>
            </div>

            {/* 피쳐드 제품 */}
            {!searchQuery && featuredProducts.length > 0 && (
              <section className="mb-8">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">추천 제품</h2>
                </div>
                <FeaturedCarousel products={featuredProducts} />
              </section>
            )}

            {/* 결과 헤더 */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {searchQuery ? `검색 결과` : '전체 제품'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    총 {filteredProducts.length}개
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                    aria-label="그리드 뷰"
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                    aria-label="리스트 뷰"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 제품 그리드/리스트 */}
            {filteredProducts.length > 0 ? (
              viewMode === 'list' ? (
                <div className="space-y-3">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} variant="list" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">검색 결과가 없습니다</p>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}
