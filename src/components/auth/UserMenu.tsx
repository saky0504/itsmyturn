import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { signInWithGoogle, signOut } from '../../lib/auth';
import { GoogleIconMono } from './GoogleIconMono';
import { toast } from 'sonner';

interface UserMenuProps {
  size?: 'sm' | 'md';
}

const SIZE_CLASS: Record<NonNullable<UserMenuProps['size']>, { box: string; icon: string; text: string }> = {
  sm: { box: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-sm' },
  md: { box: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-base' },
};

export function UserMenu({ size = 'sm' }: UserMenuProps = {}) {
  const sz = SIZE_CLASS[size];
  const { user, profile, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle(location.pathname + location.search);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '로그인에 실패했습니다';
      toast.error(msg);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setOpen(false);
      toast.success('로그아웃되었습니다');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '로그아웃에 실패했습니다';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return <div className={`${sz.box} rounded-full bg-white/80 backdrop-blur-sm shadow-lg animate-pulse`} />;
  }

  if (!user) {
    return (
      <button
        onClick={handleLogin}
        className={`relative ${sz.box} bg-white/80 rounded-full shadow-lg backdrop-blur-sm flex items-center justify-center text-gray-700 hover:bg-white hover:text-gray-900 transition-colors`}
        aria-label="Google로 로그인"
      >
        <GoogleIconMono className={sz.icon} />
      </button>
    );
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative ${sz.box} rounded-full overflow-hidden bg-white/80 backdrop-blur-sm shadow-lg hover:ring-2 hover:ring-white/80 transition-all`}
        aria-label="사용자 메뉴"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full h-full rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white ${sz.text} font-bold`}>
            {displayName[0].toUpperCase()}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">REPUTATION {profile?.reputation ?? 0}</p>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <UserIcon className="w-4 h-4" />
            <span>Profile</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors w-full text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}
