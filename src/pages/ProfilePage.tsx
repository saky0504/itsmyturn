import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Settings, LogOut, ShieldCheck, Award, Trophy, Star, Stars, MessageSquare, Lock, ArrowLeft, X, Check, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AchievementRow {
  id: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  rarity: 'common' | 'rare' | 'legendary';
  sort_order: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

const ICONS: Record<string, LucideIcon> = {
  Star,
  Stars,
  MessageSquare,
  Award,
  Trophy,
};

interface MedalStyle {
  bg: string;
  ring: string;
  glow: string;
  label: string;
}

const RARITY_MEDAL: Record<string, MedalStyle> = {
  common: {
    bg: 'bg-gradient-to-br from-slate-600 to-slate-800',
    ring: 'ring-1 ring-slate-300/40 ring-inset',
    glow: '',
    label: 'text-slate-700',
  },
  rare: {
    bg: 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700',
    ring: 'ring-2 ring-sky-300/50 ring-inset',
    glow: 'shadow-[0_8px_24px_-6px_rgba(59,130,246,0.45)]',
    label: 'text-blue-700',
  },
  legendary: {
    bg: 'bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600',
    ring: 'ring-2 ring-amber-200/70 ring-inset',
    glow: 'shadow-[0_10px_28px_-6px_rgba(251,146,60,0.55)]',
    label: 'text-amber-700',
  },
};

export function ProfilePage() {
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const openSettings = () => {
    setDraftName(profile?.display_name || '');
    setIsEditing(true);
  };

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.error('이름은 비울 수 없습니다');
      return;
    }
    if (trimmed === profile?.display_name) {
      setIsEditing(false);
      return;
    }
    setIsSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id);
    setIsSavingName(false);
    if (error) {
      toast.error(error.message || '저장 실패');
      return;
    }
    await refreshProfile();
    setIsEditing(false);
    toast.success('이름이 변경되었습니다');
  };

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setAchievementsLoading(true);
      const [defs, mine] = await Promise.all([
        supabase.from('achievements').select('id, title, description, icon_name, rarity, sort_order').order('sort_order'),
        supabase.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', user.id),
      ]);

      if (defs.error) {
        console.error('[ProfilePage] achievements error:', defs.error);
        setAchievementsLoading(false);
        return;
      }

      const unlockedMap = new Map<string, string>();
      (mine.data || []).forEach((row: { achievement_id: string; unlocked_at: string }) => {
        unlockedMap.set(row.achievement_id, row.unlocked_at);
      });

      const merged: AchievementRow[] = (defs.data || []).map((d: any) => ({
        ...d,
        unlocked: unlockedMap.has(d.id),
        unlocked_at: unlockedMap.get(d.id) ?? null,
      }));
      setAchievements(merged);
      setAchievementsLoading(false);
    };

    load();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('로그아웃되었습니다');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '로그아웃에 실패했습니다';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f0eb]">
        <div className="max-w-md mx-auto px-4 py-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border/60 bg-white shadow-sm hover:bg-muted transition-colors"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="max-w-md mx-auto px-4 py-12 text-center space-y-6">
          <h1 className="text-2xl font-bold text-foreground">로그인이 필요합니다</h1>
          <p className="text-sm text-muted-foreground">프로필을 확인하려면 Google 계정으로 로그인해주세요.</p>
          <button
            onClick={() => signInWithGoogle('/profile')}
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Google로 로그인
          </button>
          <Link to="/" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
  const reputation = profile?.reputation ?? 0;

  return (
    <div className="min-h-screen bg-[#f5f0eb]">
      <Helmet>
        <title>Profile · it's my turn</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border/60 bg-white shadow-sm hover:bg-muted transition-colors"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 프로필 카드 */}
        <section className="rounded-3xl bg-white border border-border/40 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-white shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold border-2 border-white shadow-md">
                {displayName[0].toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {profile?.is_protected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80">
                    <ShieldCheck className="w-3 h-3" />
                    Protected
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground/80">
                  <span className="text-muted-foreground">REPUTATION</span>
                  <span className="font-bold text-foreground">{reputation}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={openSettings}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* 인라인 설정 패널 */}
          {isEditing && (
            <div className="mt-6 pt-6 border-t border-border/60 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  대화명 (Display name)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                    maxLength={30}
                    placeholder="이름을 입력하세요"
                    autoFocus
                    className="flex-1 rounded-full border border-border bg-white px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName || !draftName.trim()}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="저장"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={isSavingName}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
                    aria-label="취소"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-2">
                  Enter로 저장 · Esc로 취소 · 댓글에 표시되는 이름이 즉시 바뀝니다
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 업적 갤러리 */}
        <section className="rounded-3xl bg-white border border-border/40 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                <Award className="w-5 h-5 text-foreground" />
              </span>
              <h2 className="text-xl font-bold text-foreground">Achievement Gallery</h2>
            </div>
            {!achievementsLoading && achievements.length > 0 && (
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {achievements.filter(a => a.unlocked).length} / {achievements.length}
              </span>
            )}
          </div>

          {achievementsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading Badges...</p>
            </div>
          ) : achievements.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              아직 등록된 업적이 없습니다
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-5">
              {achievements.map(a => {
                const Icon = ICONS[a.icon_name || 'Award'] || Award;
                const medal = RARITY_MEDAL[a.rarity] || RARITY_MEDAL.common;
                const unlockedAt = a.unlocked_at ? new Date(a.unlocked_at).toLocaleDateString('ko-KR') : null;

                return (
                  <div
                    key={a.id}
                    className="flex flex-col items-center gap-2 group"
                    title={a.description || a.title}
                  >
                    {/* 메달 디스크 */}
                    <div className="relative">
                      <div
                        className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                          a.unlocked
                            ? `${medal.bg} ${medal.ring} ${medal.glow} group-hover:scale-105`
                            : 'bg-gradient-to-br from-slate-200 to-slate-300 ring-1 ring-slate-200/60 ring-inset'
                        }`}
                      >
                        <Icon
                          className={`w-7 h-7 sm:w-9 sm:h-9 ${
                            a.unlocked ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]' : 'text-slate-400'
                          }`}
                          strokeWidth={a.unlocked ? 2.25 : 2}
                        />
                        {/* 잠금 오버레이 */}
                        {!a.unlocked && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-sm">
                            <Lock className="w-3 h-3 text-slate-500" />
                          </div>
                        )}
                        {/* 레전더리 sparkle */}
                        {a.unlocked && a.rarity === 'legendary' && (
                          <span className="absolute -top-1 -right-1 text-amber-300 text-lg leading-none drop-shadow-md">✦</span>
                        )}
                      </div>
                    </div>

                    {/* 라벨 */}
                    <div className="text-center min-h-[2.5rem]">
                      <p
                        className={`text-[11px] sm:text-xs font-bold leading-tight ${
                          a.unlocked ? medal.label : 'text-muted-foreground/60'
                        }`}
                      >
                        {a.title}
                      </p>
                      {a.unlocked && unlockedAt && (
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{unlockedAt}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ProfilePage;
