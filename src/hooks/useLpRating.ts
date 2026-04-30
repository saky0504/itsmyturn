import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface LpRatingState {
  myScore: number | null;
  avg: number;
  count: number;
  isLoading: boolean;
  isSaving: boolean;
  setScore: (score: number) => Promise<void>;
  clearScore: () => Promise<void>;
}

export function useLpRating(productId: string | undefined): LpRatingState {
  const { user } = useAuth();
  const [myScore, setMyScore] = useState<number | null>(null);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!productId) return;

    const summaryReq = supabase
      .from('lp_products')
      .select('avg_rating, rating_count')
      .eq('id', productId)
      .maybeSingle();

    const myReq = user
      ? supabase
          .from('lp_ratings')
          .select('score')
          .eq('product_id', productId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [summary, mine] = await Promise.all([summaryReq, myReq]);

    if (summary.data) {
      setAvg(Number(summary.data.avg_rating) || 0);
      setCount(summary.data.rating_count || 0);
    }
    if (mine && 'data' in mine && mine.data) {
      setMyScore((mine.data as { score: number }).score);
    } else {
      setMyScore(null);
    }
    setIsLoading(false);
  }, [productId, user]);

  useEffect(() => {
    setIsLoading(true);
    refresh();
  }, [refresh]);

  const setScore = useCallback(
    async (score: number) => {
      if (!user || !productId) return;
      if (score < 1 || score > 10) return;

      setIsSaving(true);
      const prev = myScore;
      setMyScore(score);

      const { error } = await supabase
        .from('lp_ratings')
        .upsert(
          { product_id: productId, user_id: user.id, score, updated_at: new Date().toISOString() },
          { onConflict: 'product_id,user_id' },
        );

      if (error) {
        console.error('[useLpRating] upsert error:', error);
        setMyScore(prev);
      } else {
        await refresh();
      }
      setIsSaving(false);
    },
    [user, productId, myScore, refresh],
  );

  const clearScore = useCallback(async () => {
    if (!user || !productId) return;
    setIsSaving(true);
    const prev = myScore;
    setMyScore(null);

    const { error } = await supabase
      .from('lp_ratings')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[useLpRating] delete error:', error);
      setMyScore(prev);
    } else {
      await refresh();
    }
    setIsSaving(false);
  }, [user, productId, myScore, refresh]);

  return { myScore, avg, count, isLoading, isSaving, setScore, clearScore };
}
