import { useEffect, useState, useCallback, useRef } from 'react';
import { checkAndSyncIfNeeded, getLastSyncTime, syncProductsFromSupabase } from '../lib/lpDataSync';
import { useLpProducts } from './useLpProducts';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export function useLpDataSync() {
  const { refresh } = useLpProducts();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(getLastSyncTime());
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 앱 시작 시 자동 동기화 체크
  useEffect(() => {
    const autoSync = async () => {
      try {
        const synced = await checkAndSyncIfNeeded();
        if (synced) {
          refresh();
          setLastSynced(getLastSyncTime());
          toast.success('LP 데이터가 업데이트되었습니다');
        }
      } catch (error) {
        console.error('Auto sync error:', error);
      }
    };

    autoSync();
  }, [refresh]);

  // Supabase realtime subscription - 가격 정보 실시간 업데이트
  useEffect(() => {
    const triggerSync = () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = setTimeout(() => {
        syncProductsFromSupabase()
          .then((result) => {
            if (result.success) {
              refresh();
              setLastSynced(result.lastSynced);
            }
          })
          .catch((error) => {
            console.error('자동 동기화 실패:', error);
          });
      }, 500);
    };

    const channel = supabase
      .channel('lp-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lp_offers' }, triggerSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lp_products' }, triggerSync)
      .subscribe();

    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // 수동 동기화
  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncProductsFromSupabase();
      if (result.success) {
        refresh();
        setLastSynced(result.lastSynced);
        toast.success(`${result.count}개의 제품이 업데이트되었습니다`);
      } else {
        toast.error('데이터 동기화에 실패했습니다');
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      toast.error('데이터 동기화에 실패했습니다');
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  return {
    isSyncing,
    lastSynced,
    manualSync,
  };
}


