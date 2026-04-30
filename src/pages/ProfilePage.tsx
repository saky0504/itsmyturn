import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Settings, LogOut, ShieldCheck, Award, Trophy, Star, Stars, MessageSquare, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { MarketHeader } from '../components/market/MarketHeader';
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

const RARITY_STYLES: Record<string, string> = {
  common: 'bg-muted text-muted-foreground border-border',
  rare: 'bg-blue-100 text-blue-700 border-blue-200',
  legendary: 'bg-amber-100 text-amber-700 border-amber-200',
};

export function ProfilePage() {
  const { user, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

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
        <MarketHeader />
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
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
      <MarketHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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
              disabled
              title="설정은 곧 추가될 예정입니다"
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
        </section>

        {/* 업적 갤러리 */}
        <section className="rounded-3xl bg-white border border-border/40 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted">
              <Award className="w-5 h-5 text-foreground" />
            </span>
            <h2 className="text-xl font-bold text-foreground">Achievement Gallery</h2>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievements.map(a => {
                const Icon = ICONS[a.icon_name || 'Award'] || Award;
                const styles = RARITY_STYLES[a.rarity] || RARITY_STYLES.common;
                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl border p-4 flex flex-col items-center text-center gap-2 transition-all ${
                      a.unlocked ? styles : 'bg-muted/30 text-muted-foreground/50 border-border/40 grayscale'
                    }`}
                    title={a.description || a.title}
                  >
                    <Icon className="w-7 h-7" />
                    <p className="text-xs font-semibold leading-tight">{a.title}</p>
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
