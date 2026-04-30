import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Settings, LogOut, ShieldCheck, Award, Trophy, Star, Stars, MessageSquare, Lock, ArrowLeft, X, Check, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { UserAvatar } from '../components/auth/UserAvatar';
import { buildAchievementAvatarUrl } from '../lib/achievements';

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
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const googleAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) || null;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const openSettings = () => {
    setDraftName('');
    setDraftAvatar(profile?.avatar_url || null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const update: { display_name?: string; avatar_url?: string | null } = {};

    const trimmed = draftName.trim();
    if (trimmed) {
      update.display_name = trimmed;
    }
    if (draftAvatar !== (profile?.avatar_url || null)) {
      update.avatar_url = draftAvatar;
    }

    if (Object.keys(update).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', user.id);
    setIsSaving(false);
    if (error) {
      toast.error(error.message || '저장 실패');
      return;
    }
    await refreshProfile();
    setIsEditing(false);
    toast.success('변경되었습니다');
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
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center h-8 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all duration-200 shadow-sm"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="text-center space-y-6 py-8">
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
      </div>
    );
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
  const reputation = profile?.reputation ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Profile · it's my turn</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 상단 액션 바 — LpProductDetail와 동일 */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center h-8 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all duration-200 shadow-sm"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* 프로필 카드 */}
        <section className="rounded-2xl bg-card/40 border border-border/40 p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <UserAvatar
              avatarUrl={avatarUrl}
              fallbackChar={displayName[0]}
              className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-white shadow-md text-2xl font-bold"
            />

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
            <div className="mt-6 pt-6 border-t border-border/60 space-y-5">
              {/* 이름 입력 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                  maxLength={30}
                  placeholder={profile?.display_name || '이름을 입력하세요'}
                  autoFocus
                  className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="저장"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
                  aria-label="취소"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 아바타 선택 */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Profile photo</p>
                <div className="flex flex-wrap gap-2.5">
                  {googleAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setDraftAvatar(googleAvatarUrl)}
                      className={`rounded-full transition-all ${
                        draftAvatar === googleAvatarUrl ? 'ring-2 ring-foreground ring-offset-2' : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Google 프로필 사진"
                    >
                      <UserAvatar avatarUrl={googleAvatarUrl} className="w-12 h-12" />
                    </button>
                  )}
                  {achievements.filter(a => a.unlocked).map(a => {
                    const url = buildAchievementAvatarUrl(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setDraftAvatar(url)}
                        className={`rounded-full transition-all ${
                          draftAvatar === url ? 'ring-2 ring-foreground ring-offset-2' : 'opacity-70 hover:opacity-100'
                        }`}
                        title={a.title}
                      >
                        <UserAvatar avatarUrl={url} className="w-12 h-12" />
                      </button>
                    );
                  })}
                  {achievements.filter(a => a.unlocked).length === 0 && (
                    <p className="text-xs text-muted-foreground/70 self-center">
                      업적을 달성하면 여기서 메달을 프로필 사진으로 쓸 수 있어요
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 업적 갤러리 */}
        <section className="rounded-2xl bg-card/40 border border-border/40 p-6 sm:p-8">
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
