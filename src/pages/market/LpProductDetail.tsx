import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  ExternalLink,
  Headphones,
  Info,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  LP_VENDOR_CHANNELS,
  buildAffiliateUrl,
  calculateOfferFinalPrice,
  formatCurrency,
  getChannelById,
  type LpOffer,
} from '../../data/lpMarket';
import { useLpProducts } from '../../hooks/useLpProducts';
import { toast } from 'sonner';

const formatter = (value: number) => formatCurrency(value);

export function LpProductDetail() {
  const { productId } = useParams();
  const { products } = useLpProducts();
  const product = products.find((item) => item.id === productId);
  const [isAlertSubscribed, setIsAlertSubscribed] = useState(false);

  const sortedOffers = useMemo(() => {
    if (!product) return [];
    return [...product.offers].sort(
      (a, b) => calculateOfferFinalPrice(a) - calculateOfferFinalPrice(b)
    );
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white/90 p-10 shadow-xl text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl text-slate-900">상품을 찾을 수 없습니다</h1>
            <p className="text-gray-600 text-sm">
              URL을 다시 확인하거나 리스트 페이지에서 다시 선택해 주세요.
            </p>
          </div>
          <Button asChild className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
            <Link to="/market">LP 가격 비교 홈으로 이동</Link>
          </Button>
        </div>
      </div>
    );
  }

  const primaryOffer = sortedOffers[0];
  const chartData = product.priceHistory.map((point) => ({
    date: point.date,
    price: point.price,
  }));

  const handleAlert = () => {
    setIsAlertSubscribed(true);
    toast.success('재입고 알림이 예약되었습니다.', {
      description:
        '재고 감지 시 푸시 알림을 보낼 수 있도록 Supabase/FCM 연동을 준비 중입니다.',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <ArrowLeft className="w-4 h-4" />
          <Link to="/market" className="hover:text-gray-800 transition-colors">
            비교 리스트
          </Link>
          <span>•</span>
          <span>{product.title}</span>
        </div>

        <header className="rounded-[32px] border border-white/40 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-3xl p-8 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span className="rounded-full border border-gray-200 px-3 py-1">
                Discogs #{product.discogsId}
              </span>
              <span className="rounded-full border border-gray-200 px-3 py-1">
                EAN {product.barcode}
              </span>
              <span className="rounded-full border border-gray-200 px-3 py-1">
                {product.category.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl md:text-4xl text-slate-900">{product.title}</h1>
              <span className="text-lg text-gray-500">· {product.artist}</span>
            </div>
            <p className="text-gray-600 text-sm md:text-base max-w-3xl">{product.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="희소성 지수 (Rarity Index)"
              value={product.rarityIndex.toFixed(2)}
              description="Wish/Collection 비율"
            />
            <MetricCard
              label="LP 투자 수익률 (LPR)"
              value={`${Math.round(product.lpr * 100)}%`}
              description="최근 3년 중고 시세 상승"
            />
            <MetricCard
              label="최근 30일 변동"
              value={`${product.last30dChange >= 0 ? '+' : ''}${Math.round(
                product.last30dChange * 100
              )}%`}
              description="실구매가 기준"
            />
          </div>
        </header>

        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl text-slate-900">가격 비교 · 배송비 포함</h2>
              <p className="text-sm text-gray-500">
                배송비 정책, 쿠폰, 카드 청구할인을 반영한 실결제 예상 금액
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-2xl border-slate-200 text-slate-700"
                onClick={!isAlertSubscribed ? handleAlert : undefined}
                disabled={isAlertSubscribed}
              >
                <BellRing className="w-4 h-4 mr-2" />
                {isAlertSubscribed ? '알림 예약됨' : '재입고 알림 신청'}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100">
            <table className="w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-gray-400">
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
                      className="border-t border-slate-100 bg-white/90 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{offer.vendorName}</span>
                          {offer.notes && <span className="text-xs text-gray-500">{offer.notes}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          to={`/market/channels/${offer.channelId}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {channel?.label || offer.channelId}
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="px-5 py-4">{formatCurrency(offer.basePrice)}</td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-gray-600">{offer.shippingPolicy}</div>
                        <div className="text-xs text-gray-400">
                          배송비 {offer.shippingFee ? formatCurrency(offer.shippingFee) : '무료'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-lg font-semibold text-slate-900">
                        {formatCurrency(finalPrice)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <a
                          href={affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
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
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_12px_50px_rgba(15,23,42,0.05)] grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-gray-400">가격 추이</div>
              <h3 className="text-xl text-slate-900">90일 가격 변동</h3>
              <p className="text-sm text-gray-500">
                커서 전략의 가격 변동 레이어 · LPR 지표와 연동됩니다.
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => value.slice(5)}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${Math.round(value / 1000)}K`}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <Tooltip formatter={formatter} labelFormatter={(label) => `기준일 ${label}`} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#0f172a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#priceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-gray-400">
                <Info className="w-4 h-4" />
                커서 전략
              </div>
              <p className="text-sm text-gray-600">
                이 LP는 Wish/Collection ratio가 0.74로 측정되어, 중고 시장에서 공급 부족 위험이
                있습니다. Cursor의 Goldmine 등급 시각화와 연동하면 컨디션별 가격 차이를 실시간으로
                노출할 수 있습니다.
              </p>
              <p className="text-sm text-gray-600">
                추천 장비 매칭: {product.recommendedPairing.turntable} ·{' '}
                {product.recommendedPairing.cartridge} · {product.recommendedPairing.phonoStage}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-gray-400">
                <Headphones className="w-4 h-4" />
                LISTENING NOTES
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                {product.listeningNotes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <BadgeCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_12px_50px_rgba(15,23,42,0.05)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl text-slate-900">채널 디테일</h3>
              <p className="text-sm text-gray-500">
                재고 알림은 {product.restockVendors.length}개 채널에서 동기화됩니다.
              </p>
            </div>
            <Button variant="outline" asChild className="rounded-2xl border-slate-200 text-slate-700">
              <Link to="/market/channels/mega-book">
                전체 채널 보기
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.restockVendors.map((channelId) => {
              const channel = getChannelById(channelId);
              if (!channel) return null;
              return (
                <div
                  key={channel.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg text-slate-900">{channel.label}</h4>
                    <span className="text-xs text-gray-500">{channel.updateCadence}</span>
                  </div>
                  <p className="text-sm text-gray-600">{channel.description}</p>
                  <div className="text-xs text-gray-500">
                    샘플 셀러 · {channel.sampleSellers.join(', ')}
                  </div>
                  <p className="rounded-2xl bg-white p-3 text-sm text-slate-600 shadow-inner">
                    {channel.shippingTip}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
}

function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-inner">
      <div className="text-xs uppercase tracking-[0.2em] text-gray-400">{label}</div>
      <div className="text-2xl text-slate-900">{value}</div>
      <div className="text-sm text-gray-500">{description}</div>
    </div>
  );
}

export default LpProductDetail;


