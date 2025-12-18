import { useEffect, useState, useCallback } from 'react';
import { checkAndSyncIfNeeded, getLastSyncTime, syncProductsFromSupabase } from '../lib/lpDataSync';
import { useLpProducts } from './useLpProducts';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export function useLpDataSync() {
  const { refresh } = useLpProducts();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(getLastSyncTime());

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
    // lp_offers 테이블 변경 감지
    const channel = supabase
      .channel('lp-offers-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lp_offers',
        },
        (payload) => {
          console.log('가격 정보 업데이트 감지:', payload);
          
          // 가격 정보가 업데이트되면 즉시 동기화
          syncProductsFromSupabase()
            .then((result) => {
              if (result.success) {
                refresh();
                setLastSynced(result.lastSynced);
                // 너무 많은 토스트 방지를 위해 조용히 업데이트
                console.log('가격 정보가 자동으로 업데이트되었습니다');
              }
            })
            .catch((error) => {
              console.error('가격 정보 자동 업데이트 실패:', error);
            });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lp_products',
        },
        (payload) => {
          console.log('제품 정보 업데이트 감지:', payload);
          
          // 제품 정보가 업데이트되면 즉시 동기화
          syncProductsFromSupabase()
            .then((result) => {
              if (result.success) {
                refresh();
                setLastSynced(result.lastSynced);
                console.log('제품 정보가 자동으로 업데이트되었습니다');
              }
            })
            .catch((error) => {
              console.error('제품 정보 자동 업데이트 실패:', error);
            });
        }
      )
      .subscribe();

    return () => {
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


