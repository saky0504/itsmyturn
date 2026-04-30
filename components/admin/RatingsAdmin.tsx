import { useEffect, useMemo, useState } from 'react';
import { Trash2, RefreshCw, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { supabase as adminSupabase } from '../../src/lib/supabase';

interface RatingRow {
  id: string;
  product_id: string;
  user_id: string;
  score: number;
  created_at: string;
  updated_at: string;
  product?: { title: string; artist: string } | null;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
}

async function fetchAdminApi(action: string, payload: any) {
  const token = sessionStorage.getItem('admin_token') || import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
  const res = await fetch('/api/admin/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `API ${res.status}`);
  }
  return res.json();
}

export function RatingsAdmin() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchRatings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await adminSupabase
        .from('lp_ratings')
        .select(`
          id, product_id, user_id, score, created_at, updated_at,
          product:lp_products(title, artist),
          profile:profiles(display_name, avatar_url)
        `)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setRows((data || []) as unknown as RatingRow[]);
    } catch (err: any) {
      toast.error(err?.message || '별점 로드 실패');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatings();
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(r =>
      r.product?.title?.toLowerCase().includes(q) ||
      r.product?.artist?.toLowerCase().includes(q) ||
      r.profile?.display_name?.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const stats = useMemo(() => {
    if (rows.length === 0) return { count: 0, avg: 0 };
    const sum = rows.reduce((s, r) => s + r.score, 0);
    return { count: rows.length, avg: Number((sum / rows.length).toFixed(2)) };
  }, [rows]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 별점을 삭제할까요?')) return;
    try {
      await fetchAdminApi('deleteRating', { id });
      setRows(rows.filter(r => r.id !== id));
      toast.success('별점 삭제됨');
    } catch (err: any) {
      toast.error(err?.message || '삭제 실패');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="전체 별점 수" value={stats.count.toLocaleString()} />
        <StatCard label="평균 점수" value={stats.avg.toFixed(2)} suffix="/ 10" />
        <StatCard label="고유 사용자" value={new Set(rows.map(r => r.user_id)).size.toLocaleString()} />
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="앨범/아티스트/사용자 검색..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <Button onClick={fetchRatings} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">별점 목록 ({filtered.length})</h3>
        </div>
        <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-500">불러오는 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">별점이 없습니다</p>
            </div>
          ) : (
            filtered.map(r => (
              <div key={r.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                <div className="flex-shrink-0">
                  {r.profile?.avatar_url ? (
                    <img src={r.profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                      {(r.profile?.display_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.product?.title || '(삭제됨)'} <span className="text-gray-500">— {r.product?.artist || ''}</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {r.profile?.display_name || r.user_id.slice(0, 8)} · {new Date(r.updated_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full font-bold tabular-nums text-white"
                    style={{ backgroundColor: scoreColor(r.score) }}
                  >
                    {r.score}
                  </span>
                  <Button
                    onClick={() => handleDelete(r.id)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
        {value}
        {suffix && <span className="text-sm text-gray-500 font-medium ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function scoreColor(score: number): string {
  const t = (score - 1) / 9;
  const hue = Math.round(t * 130);
  return `hsl(${hue}, 78%, ${48 - Math.round(t * 12)}%)`;
}
