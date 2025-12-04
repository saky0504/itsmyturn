import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Package, RefreshCcw, ShieldCheck, Store } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { LP_VENDOR_CHANNELS } from '../../data/lpMarket';
import { MarketHeader } from '../../components/market/MarketHeader';

export function LpChannelDetail() {
  const { channelId } = useParams();
  const activeChannel =
    LP_VENDOR_CHANNELS.find((channel) => channel.id === channelId) || LP_VENDOR_CHANNELS[0];

  return (
    <div className="min-h-screen bg-background">
      <MarketHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          <Link to="/market" className="hover:text-foreground transition-colors">
            가격 비교
          </Link>
          <span>•</span>
          <span>채널 디테일</span>
        </div>

        <header className="rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.08)] p-6 space-y-4">
          <h1 className="text-2xl sm:text-3xl text-foreground">
            {activeChannel.label} · LP 유통 채널 정보
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-3xl">
            {activeChannel.description}
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl text-foreground">{activeChannel.label}</h2>
              <p className="text-sm text-muted-foreground">{activeChannel.description}</p>
            </div>
            <Button
              asChild
              className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link to="/market" className="flex items-center gap-2">
                비교 페이지로 이동
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <InfoPill
              title="대표 샵"
              icon={<Store className="w-4 h-4 text-muted-foreground" />}
              content={activeChannel.sampleSellers.join(', ')}
            />
            <InfoPill
              title="배송/프로모션 팁"
              icon={<Package className="w-4 h-4 text-muted-foreground" />}
              content={activeChannel.shippingTip}
            />
            <InfoPill
              title="데이터 갱신 주기"
              icon={<RefreshCcw className="w-4 h-4 text-muted-foreground" />}
              content={activeChannel.updateCadence}
            />
          </div>

          <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
            <strong className="text-foreground">특징</strong> · {activeChannel.differentiator}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-inner space-y-4">
          <div>
            <h3 className="text-lg text-foreground">다른 채널 살펴보기</h3>
            <p className="text-sm text-muted-foreground">
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
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-border/80'
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

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_12px_50px_rgba(15,23,42,0.05)] space-y-4">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            Commission Ready
          </div>
          <p className="text-sm text-muted-foreground">
            Itsmyturn은 각 채널별 파트너 파라미터를 미리 정의해 두었습니다. 새로운 채널을 연동할 때는
            관리자 페이지에서 URL과 파라미터 키를 입력하면 자동으로 커서 링크가 생성됩니다.
          </p>
          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-border text-foreground"
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
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="text-sm text-foreground">{content}</p>
    </div>
  );
}

export default LpChannelDetail;


