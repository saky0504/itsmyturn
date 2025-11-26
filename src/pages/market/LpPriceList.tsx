import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Disc3,
  Filter,
  Info,
  Layers3,
  MessageCircle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { CommunityBoard } from '../../../components/CommunityBoard';
import {
  LP_CATEGORY_TREE,
  LP_FILTER_DIMENSIONS,
  LP_VENDOR_CHANNELS,
  calculateOfferFinalPrice,
  formatCurrency,
  type LpOffer,
  type LpProduct,
} from '../../data/lpMarket';
import { useLpProducts } from '../../hooks/useLpProducts';

type SortKey = 'finalPrice' | 'rarity' | 'yield';

const getBestOffer = (offers: LpOffer[]) => {
  if (!offers?.length) return undefined;
  return [...offers]
    .filter((offer) => offer.inStock)
    .sort((a, b) => calculateOfferFinalPrice(a) - calculateOfferFinalPrice(b))[0];
};

const getSparklinePoints = (product: LpProduct) => {
  const recent = product.priceHistory.slice(-6);
  if (recent.length === 0) return '';
  const max = Math.max(...recent.map((point) => point.price));
  const min = Math.min(...recent.map((point) => point.price));
  const range = max - min || 1;

  return recent
    .map((point, index) => {
      const x = (index / (recent.length - 1 || 1)) * 100;
      const y = 100 - ((point.price - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');
};

export function LpPriceList() {
  const { products } = useLpProducts();
  const [colorFilter, setColorFilter] = useState('All');
  const [editionFilter, setEditionFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('finalPrice');
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const navigate = useNavigate();

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesColor =
        colorFilter === 'All' ||
        product.color === colorFilter ||
        product.colorVariants.includes(colorFilter);
      const matchesEdition =
        editionFilter === 'All' ||
        product.edition === editionFilter ||
        product.editionVariants.includes(editionFilter);
      const matchesCountry = countryFilter === 'All' || product.country === countryFilter;
      return matchesColor && matchesEdition && matchesCountry;
    });
  }, [products, colorFilter, editionFilter, countryFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      if (sortKey === 'rarity') {
        return b.rarityIndex - a.rarityIndex;
      }
      if (sortKey === 'yield') {
        return b.lpr - a.lpr;
      }
      const offerA = getBestOffer(a.offers);
      const offerB = getBestOffer(b.offers);
      const priceA = offerA ? calculateOfferFinalPrice(offerA) : Number.MAX_SAFE_INTEGER;
      const priceB = offerB ? calculateOfferFinalPrice(offerB) : Number.MAX_SAFE_INTEGER;
      return priceA - priceB;
    });
  }, [filteredProducts, sortKey]);

  const actionButtons = [
    {
      id: 'home',
      onClick: () => navigate('/'),
      aria: '메인 LP 플레이어로 이동',
      Icon: Disc3,
    },
    {
      id: 'info',
      onClick: () => setIsInfoOpen(true),
      aria: '음원 앨범 정보 보기',
      Icon: Info,
    },
    {
      id: 'board',
      onClick: () => setIsBoardOpen(true),
      aria: '커뮤니티 게시판 열기',
      Icon: MessageCircle,
    },
  ];

  const renderActionButtons = () =>
    actionButtons.map(({ id, onClick, aria, Icon }) => (
      <button key={id} type="button" onClick={onClick} className="group" aria-label={aria}>
        <div className="relative">
          <div
            className="w-12 h-12 rounded-full bg-white opacity-25 group-hover:opacity-40 transition-opacity duration-200"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-5 h-5 text-black group-hover:text-gray-800 transition-colors duration-200" />
          </div>
        </div>
      </button>
    ));

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 relative">
        <div className="hidden md:block fixed top-[85px] left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4">
          <div className="flex justify-end gap-3">{renderActionButtons()}</div>
        </div>

        <div className="md:hidden fixed top-4 right-4 z-40 flex items-center gap-3">
          {renderActionButtons()}
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="space-y-6">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <ArrowLeft className="w-4 h-4" />
            <Link to="/" className="hover:text-gray-800 transition-colors">
              돌아가기
            </Link>
            <span>•</span>
            <span>LP 마켓 인텔리전스</span>
          </div>

          <div className="rounded-[32px] border border-white/40 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-3xl p-8 space-y-6">
            <div className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-gray-400">
                Itsmyturn Cursor Strategy
              </span>
              <h1 className="text-3xl md:text-4xl leading-snug text-slate-900">
                희소성 지수와 커미션 트래킹이 결합된
                <br />
                LP 전문 가격 비교 랩
              </h1>
              <p className="text-gray-600 max-w-2xl">
                Discogs·EAN 기준으로 정확하게 매칭된 상품만 비교하고, 배송비와 카드 청구
                혜택까지 반영한 실구매가를 제공합니다. 커미션 링크는 자동으로 추적되며,
                Cursor 전략으로 제안한 희소성 지수 · 투자 수익률을 곁들였습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-inner">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-gray-700">
                  희소성 지수 평균{' '}
                  <strong className="text-slate-900">
                    {(products.reduce((sum, lp) => sum + lp.rarityIndex, 0) / products.length)
                      .toFixed(2)
                      .replace(/0+$/, '')}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-inner">
                <SlidersHorizontal className="w-4 h-4 text-rose-500" />
                <span className="text-sm text-gray-700">
                  실시간 배송비 반영 · 커미션 세팅 완료
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-inner">
                <Layers3 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-gray-700">데이터 동기화 4개 채널</span>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-100 bg-white/90 shadow-[0_10px_40px_rgba(15,23,42,0.06)] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-gray-600 text-sm">
              <Filter className="w-4 h-4 text-slate-500" />
              <span>컬러 · 에디션 · 생산국 필터</span>
            </div>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="finalPrice">최저 실구매가 순</option>
              <option value="rarity">희소성 높은 순</option>
              <option value="yield">투자 수익률 높은 순</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FilterGroup
              label="색상"
              options={LP_FILTER_DIMENSIONS.colors}
              value={colorFilter}
              onChange={setColorFilter}
            />
            <FilterGroup
              label="에디션"
              options={LP_FILTER_DIMENSIONS.editions}
              value={editionFilter}
              onChange={setEditionFilter}
            />
            <FilterGroup
              label="국가"
              options={LP_FILTER_DIMENSIONS.countries}
              value={countryFilter}
              onChange={setCountryFilter}
            />
          </div>
        </section>

        <section className="space-y-4">
          {sortedProducts.map((product) => {
            const bestOffer = getBestOffer(product.offers);
            const sparkline = getSparklinePoints(product);
            return (
              <article
                key={product.id}
                className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl flex flex-col gap-6"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                      Discogs #{product.discogsId}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                      EAN {product.barcode}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-600 px-3 py-1 text-sm">
                      희소성 {product.rarityIndex.toFixed(2)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-600 px-3 py-1 text-sm">
                      LPR {Math.round(product.lpr * 100)}%
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-2xl text-slate-900">{product.title}</h2>
                    <span className="text-base text-gray-500">· {product.artist}</span>
                  </div>
                  <p className="text-gray-600 text-sm md:text-base max-w-4xl">
                    {product.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 items-center">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-600">
                      <span>{product.color}</span>
                      <span>•</span>
                      <span>{product.edition}</span>
                      <span>•</span>
                      <span>{product.country}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      {bestOffer ? (
                        <>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">
                              최저 실구매가
                            </div>
                            <div className="text-3xl text-slate-900">
                              {formatCurrency(calculateOfferFinalPrice(bestOffer))}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {bestOffer.vendorName} · {bestOffer.channelId}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">현재 재고 없음</p>
                      )}
                    </div>
                    {sparkline && (
                      <svg viewBox="0 0 100 100" className="mt-4 h-16 w-full text-indigo-500">
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={sparkline}
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      asChild
                      className="h-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                    >
                      <Link to={`/market/lp/${product.id}`} className="flex items-center gap-2">
                        상세 비교 보기
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 rounded-2xl border-slate-200 text-slate-700"
                    >
                      <Link to={`/market/channels/${bestOffer?.channelId || 'mega-book'}`}>
                        채널 특성 보기
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_12px_50px_rgba(15,23,42,0.05)] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl text-slate-900">LP 채널 인사이트</h3>
              <p className="text-sm text-gray-500">
                커서 전략으로 분류한 4개 채널의 특성과 배송비 정책
              </p>
            </div>
            <Button
              variant="outline"
              asChild
              className="rounded-2xl border-slate-200 text-slate-700"
            >
              <Link to="/market/channels/mega-book" className="flex items-center gap-2">
                전체 채널 보기
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LP_VENDOR_CHANNELS.map((channel) => (
              <div
                key={channel.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-lg text-slate-900">{channel.label}</h4>
                  <span className="text-xs uppercase tracking-[0.3em] text-gray-400">
                    {channel.updateCadence}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{channel.description}</p>
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">대표 샵</span> ·{' '}
                  {channel.sampleSellers.join(', ')}
                </div>
                <div className="rounded-2xl bg-white p-3 text-sm text-slate-600 shadow-inner">
                  {channel.shippingTip}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-inner">
          <h3 className="text-lg text-slate-900 mb-4">카테고리 구조</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {LP_CATEGORY_TREE.map((category) => (
              <div
                key={category.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-2"
              >
                <div className="text-sm uppercase tracking-[0.2em] text-gray-500">
                  {category.label}
                </div>
                <ul className="space-y-1 text-sm text-slate-700">
                  {category.children.map((child) => (
                    <li key={child.id}>• {child.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>

      <CommunityBoard isOpen={isBoardOpen} onClose={() => setIsBoardOpen(false)} />

      {isInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setIsInfoOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsInfoOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="정보 팝업 닫기"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-5 pt-4 text-center">
              <img
                src="/images/bymeacoffee.jpg"
                alt="Buy me a Coffee"
                className="w-full rounded-2xl shadow-md"
                loading="lazy"
              />
              <p className="text-sm text-gray-600">
                Internet Archive의 공공 도메인 음원과 Creative Commons 트랙을 기반으로 한
                무료 LP 플레이어입니다. 작은 후원이 새로운 음원을 발견하는 데 큰 힘이 됩니다.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-600">
                <a
                  href="/privacy-policy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-900 transition-colors"
                >
                  Privacy Policy
                </a>
                <span>•</span>
                <a
                  href="/terms-of-service.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-900 transition-colors"
                >
                  Terms of Service
                </a>
                <span>•</span>
                <span>Public Domain</span>
                <span>•</span>
                <span>Free to use</span>
              </div>
              <p className="text-xs text-gray-400">© 2025 It's My Turn • All rights reserved</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface FilterGroupProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

function FilterGroup({ label, options, value, onChange }: FilterGroupProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 flex flex-wrap gap-2">
      <div className="text-xs uppercase tracking-[0.3em] text-gray-400 w-full">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-2xl border px-3 py-1 text-sm transition-all ${
              value === option
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default LpPriceList;


