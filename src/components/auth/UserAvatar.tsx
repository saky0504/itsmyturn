import { AVATAR_ACHIEVEMENTS, isAchievementAvatar, achievementIdFromUrl } from '../../lib/achievements';

interface UserAvatarProps {
  avatarUrl?: string | null;
  fallbackChar?: string;
  className?: string;
}

/**
 * 사용자 아바타 통합 렌더러.
 * - avatarUrl이 'achievement:<id>' → 메달 그라데이션 + Lucide 아이콘
 * - avatarUrl이 일반 URL → <img>
 * - 그 외 → fallbackChar (이름 첫 글자)
 */
export function UserAvatar({ avatarUrl, fallbackChar, className = 'w-10 h-10' }: UserAvatarProps) {
  if (isAchievementAvatar(avatarUrl)) {
    const id = achievementIdFromUrl(avatarUrl as string);
    const info = AVATAR_ACHIEVEMENTS[id];
    if (info) {
      const Icon = info.icon;
      return (
        <div
          className={`${className} rounded-full bg-gradient-to-br ${info.gradient} flex items-center justify-center text-white shrink-0`}
        >
          <Icon className="w-1/2 h-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" strokeWidth={2.25} />
        </div>
      );
    }
  }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${className} rounded-full object-cover shrink-0`}
        referrerPolicy="no-referrer"
        draggable={false}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold shrink-0`}
    >
      {(fallbackChar || '?').toUpperCase()}
    </div>
  );
}
