import { Star, Stars, MessageSquare, Award, Trophy, type LucideIcon } from 'lucide-react';

// Avatar로 사용 가능한 업적 메타데이터 (메달 그라데이션 + 아이콘)
// 새 업적이 추가되면 여기에도 등록
export const AVATAR_ACHIEVEMENTS: Record<string, { icon: LucideIcon; gradient: string }> = {
  'first-rating':    { icon: Star,           gradient: 'from-slate-600 to-slate-800' },
  'rater-10':        { icon: Stars,          gradient: 'from-slate-600 to-slate-800' },
  'first-comment':   { icon: MessageSquare,  gradient: 'from-slate-600 to-slate-800' },
  'reputation-100':  { icon: Award,          gradient: 'from-sky-500 via-blue-600 to-indigo-700' },
  'reputation-500':  { icon: Trophy,         gradient: 'from-amber-300 via-amber-500 to-orange-600' },
};

export const ACHIEVEMENT_PREFIX = 'achievement:';

export function isAchievementAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith(ACHIEVEMENT_PREFIX);
}

export function achievementIdFromUrl(url: string): string {
  return url.slice(ACHIEVEMENT_PREFIX.length);
}

export function buildAchievementAvatarUrl(achievementId: string): string {
  return ACHIEVEMENT_PREFIX + achievementId;
}
