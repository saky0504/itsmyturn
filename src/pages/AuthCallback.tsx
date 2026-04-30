import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      // Supabase JS는 URL의 #access_token 또는 ?code= 파라미터를 자동으로 처리
      // detectSessionInUrl이 default true이므로 getSession만 기다리면 됨
      await supabase.auth.getSession();
      if (cancelled) return;
      const next = params.get('next') || '/';
      navigate(next, { replace: true });
    };

    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-muted-foreground">로그인 처리 중...</p>
      </div>
    </div>
  );
}

export default AuthCallback;
