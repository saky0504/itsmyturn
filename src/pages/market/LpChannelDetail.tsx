import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Package, RefreshCcw, ShieldCheck, Store } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { LP_VENDOR_CHANNELS } from '../../data/lpMarket';

export function LpChannelDetail() {
  const { channelId } = useParams();
  const activeChannel =
    LP_VENDOR_CHANNELS.find((channel) => channel.id === channelId) || LP_VENDOR_CHANNELS[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <ArrowLeft className="w-4 h-4" />
          <Link to="/market" className="hover:text-gray-800 transition-colors">
            가격 비교
          </Link>
          <span>•</span>
          <span>채널 디테일</span>
        </div>

        <header className="rounded-[32px] border border-white/40 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-3xl p-8 space-y-4">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Cursor Strategy</div>
          <h1 className="text-3xl text-slate-900">
            {activeChannel.label} · LP 유통 채널 인사이트
          </h1>
          <p className="text-gray-600 text-sm md:text-base max-w-3xl">
            각 채널은 고객 여정과 커미션 구조가 다릅니다. Cursor 전략은 채널의 재고 변동성과
            배송비 정책을 통합해, 파트너스 링크가 언제 가장 높은 수익을 내는지 알려줍니다.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl text-slate-900">{activeChannel.label}</h2>
              <p className="text-sm text-gray-500">{activeChannel.description}</p>
            </div>
            <Button
              asChild
              className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
            >
              <Link to="/market" className="flex items-center gap-2">
                비교 페이지로 이동
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <InfoPill
              title="대표 샵"
              icon={<Store className="w-4 h-4 text-slate-500" />}
              content={activeChannel.sampleSellers.join(', ')}
            />
            <InfoPill
              title="배송/프로모션 팁"
              icon={<Package className="w-4 h-4 text-slate-500" />}
              content={activeChannel.shippingTip}
            />
            <InfoPill
              title="데이터 갱신 주기"
              icon={<RefreshCcw className="w-4 h-4 text-slate-500" />}
              content={activeChannel.updateCadence}
            />
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5 text-sm text-slate-700">
            <strong className="text-slate-900">Cursor Moat</strong> · {activeChannel.differentiator}
          </div>
        </section>

        <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-inner space-y-4">
          <div>
            <h3 className="text-lg text-slate-900">다른 채널 살펴보기</h3>
            <p className="text-sm text-gray-500">
              버튼을 클릭하면 상단 요약이 해당 채널로 전환됩니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LP_VENDOR_CHANNELS.map((channel) => (
              <Link
                key={channel.id}
                to={`/market/channels/${channel.id}`}
                className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-all ${
                  channel.id === activeChannel.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-base font-medium">{channel.label}</span>
                <span className="text-sm">
                  {channel.sampleSellers.slice(0, 3).join(', ')}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_12px_50px_rgba(15,23,42,0.05)] space-y-4">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-gray-400">
            <ShieldCheck className="w-4 h-4" />
            Commission Ready
          </div>
          <p className="text-sm text-gray-600">
            Itsmyturn은 각 채널별 파트너 파라미터를 미리 정의해 두었습니다. 새로운 채널을 연동할 때는
            관리자 페이지에서 URL과 파라미터 키를 입력하면 자동으로 커서 링크가 생성됩니다.
          </p>
          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-200 text-slate-700"
          >
            <Link to="/admin" className="flex items-center gap-2">
              관리자 페이지 접속
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

interface InfoPillProps {
  title: string;
  content: string;
  icon: ReactNode;
}

function InfoPill({ title, content, icon }: InfoPillProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-gray-400">
        {icon}
        {title}
      </div>
      <p className="text-sm text-slate-700">{content}</p>
    </div>
  );
}

export default LpChannelDetail;


