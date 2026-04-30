import { useEffect, useRef, useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { signInWithGoogle } from '../../lib/auth';
import { useNativeFeatures } from '../../hooks/useNativeFeatures';
import { useLpRating } from '../../hooks/useLpRating';

interface LpRatingDiscProps {
  productId: string;
}

const NEUTRAL_LABEL_COLOR = '#9ca3af'; // gray-400, 점수 없을 때

// 1-10 점수 → HSL 색상 (빨강 → 황색 → 초록, 토마토미터 톤)
function scoreToColor(score: number): string {
  const t = (score - 1) / 9;
  const hue = Math.round(t * 130);
  const sat = 78;
  const light = 48 - Math.round(t * 12);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
  );
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
  const hasAnyScore = (displayScore || 0) > 0;

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

  const labelColor = hasAnyScore ? scoreToColor(displayScore) : NEUTRAL_LABEL_COLOR;

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
    <section className="rounded-2xl bg-card/40 border border-border/40 p-4 sm:p-5">
      <div className="flex flex-row items-center gap-4 sm:gap-6">
        {/* LP 디스크 + 슬라이더 */}
        <div className="relative w-32 sm:w-36 aspect-square shrink-0 select-none">
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

            {/* 중앙 라벨 (점수에 따라 색 변화) — inset-[26%]으로 정확히 중앙에 48% 크기 */}
            <div
              className="absolute inset-[26%] rounded-full flex flex-col items-center justify-center"
              style={{
                backgroundColor: labelColor,
                transform: `rotate(${-(displayScore || 0) * 18}deg)`,
                transition: isDragging
                  ? 'background-color 0.15s ease-out'
                  : 'background-color 0.2s ease-out, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.22), inset 0 -2px 6px rgba(255,255,255,0.18)',
              }}
            >
              <span className="text-white text-2xl sm:text-3xl font-black tabular-nums leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                {displayScore || '–'}
              </span>
              <span className="text-white/90 text-[8px] sm:text-[9px] font-bold tracking-widest uppercase mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                {showAvgFallback ? 'AVG' : '/ 10'}
              </span>
            </div>

            {/* 중앙 홀 */}
            <div
              className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black z-10"
              style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
            />
          </div>
        </div>

        {/* 우측 정보 — 컴팩트 */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground tabular-nums leading-none">
              {count > 0 ? avg.toFixed(1) : '–'}
            </span>
            <span className="text-sm text-muted-foreground font-medium">/ 10</span>
            <span className="text-xs text-muted-foreground/70 ml-1">· {count.toLocaleString()}명</span>
          </div>

          {hasMyRating && (
            <p className="text-xs text-muted-foreground">
              내 점수 <span className="font-bold tabular-nums" style={{ color: scoreToColor(myScore!) }}>{myScore}</span>
            </p>
          )}

          {!user ? (
            <button
              onClick={() => signInWithGoogle(window.location.pathname)}
              className="inline-flex items-center gap-2 rounded-full bg-white border border-border/60 pl-1.5 pr-3.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white">
                <GoogleIcon className="w-3.5 h-3.5" />
              </span>
              로그인하고 별점
            </button>
          ) : hasMyRating ? (
            <button
              onClick={clearScore}
              disabled={isSaving}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              취소
            </button>
          ) : (
            <p className="text-xs text-muted-foreground/70">디스크를 좌우로 드래그</p>
          )}
        </div>
      </div>
    </section>
  );
}
