import { useEffect, useRef, useState, useCallback } from 'react';
import { LogIn, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { signInWithGoogle } from '../../lib/auth';
import { useNativeFeatures } from '../../hooks/useNativeFeatures';
import { useLpRating } from '../../hooks/useLpRating';

interface LpRatingDiscProps {
  productId: string;
}

// 1-10 점수 → HSL 색상 (빨강 → 황색 → 초록, 토마토미터 톤)
function scoreToColor(score: number): string {
  const t = (score - 1) / 9;
  const hue = Math.round(t * 130);
  const sat = 78;
  const light = 48 - Math.round(t * 12);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function scoreToLabel(score: number): string {
  if (score <= 2) return 'Awful';
  if (score <= 4) return 'Meh';
  if (score <= 6) return 'OK';
  if (score <= 8) return 'Great';
  return 'Masterpiece';
}

export function LpRatingDisc({ productId }: LpRatingDiscProps) {
  const { user } = useAuth();
  const { hapticMedium } = useNativeFeatures();
  const { myScore, avg, count, isLoading, isSaving, setScore, clearScore } = useLpRating(productId);

  const discRef = useRef<HTMLDivElement>(null);
  const [draftScore, setDraftScore] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastHapticRef = useRef<number | null>(null);

  // 미리보기 (드래그 중) 또는 확정 점수 또는 평균
  const displayScore = draftScore ?? myScore ?? Math.round(avg);
  const hasMyRating = myScore !== null;
  const showAvgFallback = !hasMyRating && draftScore === null && avg > 0;

  const computeScoreFromPointer = useCallback((clientX: number): number => {
    const el = discRef.current;
    if (!el) return 5;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
    return Math.max(1, Math.min(10, Math.round(ratio * 9 + 1)));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!user || isSaving) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    const next = computeScoreFromPointer(e.clientX);
    setDraftScore(next);
    lastHapticRef.current = next;
    hapticMedium();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const next = computeScoreFromPointer(e.clientX);
    if (next !== draftScore) {
      setDraftScore(next);
      if (lastHapticRef.current !== next) {
        lastHapticRef.current = next;
        hapticMedium();
      }
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const finalScore = draftScore;
    setDraftScore(null);
    if (finalScore !== null && finalScore !== myScore) {
      await setScore(finalScore);
    }
  };

  // 키보드 접근성
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!user || isSaving) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      next = Math.min(10, (myScore ?? 5) + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      next = Math.max(1, (myScore ?? 5) - 1);
    }
    if (next !== null) {
      e.preventDefault();
      setScore(next);
    }
  };

  const labelColor = scoreToColor(displayScore || 5);
  const labelOpacity = displayScore && displayScore > 0 ? 1 : 0.35;

  useEffect(() => {
    return () => {
      lastHapticRef.current = null;
    };
  }, []);

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-card/40 border border-border/40 p-6 sm:p-8 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" />
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-card/40 border border-border/40 p-6 sm:p-8">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">
        {/* LP 디스크 + 슬라이더 */}
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-square select-none">
          {/* 외곽 그림자 */}
          <div className="absolute inset-0 rounded-full shadow-[0_18px_48px_rgba(0,0,0,0.18)]" />

          {/* 디스크 본체 */}
          <div
            ref={discRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            tabIndex={user ? 0 : -1}
            role={user ? 'slider' : undefined}
            aria-label={user ? '별점 1~10' : undefined}
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={myScore ?? undefined}
            aria-disabled={!user}
            className={`absolute inset-0 rounded-full vinyl-base-gradient touch-none ${
              user ? 'cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary' : 'cursor-not-allowed'
            }`}
            style={{
              transform: `rotate(${(displayScore || 0) * 18}deg)`,
              transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* 그루브 패턴 */}
            <div className="absolute inset-2 rounded-full vinyl-groove-pattern opacity-80" />

            {/* 중앙 라벨 (점수에 따라 색 변화) */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center transition-colors duration-200"
              style={{
                width: '52%',
                height: '52%',
                backgroundColor: labelColor,
                opacity: labelOpacity,
                transform: `translate(-50%, -50%) rotate(${-(displayScore || 0) * 18}deg)`,
                transition: isDragging
                  ? 'background-color 0.15s ease-out'
                  : 'background-color 0.2s ease-out, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.18), inset 0 -2px 6px rgba(255,255,255,0.18)',
              }}
            >
              <span className="text-white text-5xl sm:text-6xl font-black tabular-nums leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
                {displayScore || '–'}
              </span>
              <span className="text-white/90 text-[10px] sm:text-xs font-bold tracking-widest uppercase mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                {showAvgFallback ? 'AVG' : '/ 10'}
              </span>
            </div>

            {/* 중앙 홀 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-black z-10"
              style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
            />
          </div>
        </div>

        {/* 우측 정보 */}
        <div className="flex-1 min-w-0 w-full space-y-4 text-center md:text-left">
          <div>
            <h3 className="text-xl font-bold text-foreground">평점</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {user
                ? '디스크 위를 드래그해서 1~10점을 매겨보세요'
                : '로그인하면 별점을 남길 수 있어요'}
            </p>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">평균</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {count > 0 ? avg.toFixed(1) : '–'}
                <span className="text-sm font-medium text-muted-foreground"> / 10</span>
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">{count.toLocaleString()}명 참여</p>
            </div>

            {hasMyRating && (
              <div className="border-l border-border pl-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">내 점수</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: scoreToColor(myScore!) }}>
                  {myScore}
                </p>
                <p className="text-xs font-medium" style={{ color: scoreToColor(myScore!) }}>
                  {scoreToLabel(myScore!)}
                </p>
              </div>
            )}
          </div>

          {!user ? (
            <button
              onClick={() => signInWithGoogle(window.location.pathname)}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Google로 로그인
            </button>
          ) : hasMyRating ? (
            <button
              onClick={clearScore}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              내 점수 취소
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
