import { supabase } from './supabase';

export async function signInWithGoogle(redirectPath: string = '/') {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function claimLoginBonus(): Promise<{ granted: boolean; reputation: number } | null> {
  const { data, error } = await supabase.rpc('claim_login_bonus');
  if (error) {
    console.error('[claim_login_bonus]', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { granted: !!row.granted, reputation: row.reputation ?? 0 };
}
