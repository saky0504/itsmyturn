import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { RefreshCw, Search, Plus, Minus, ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const adminSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

interface MemberRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  reputation: number;
  is_protected: boolean;
  created_at: string;
  rating_count?: number;
  comment_count?: number;
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

export function MembersAdmin() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error } = await adminSupabase
        .from('profiles')
        .select('id, display_name, avatar_url, reputation, is_protected, created_at')
        .order('reputation', { ascending: false })
        .limit(500);

      if (error) throw error;

      const ids = (profiles || []).map(p => p.id);
      if (ids.length === 0) {
        setRows([]);
        return;
      }

      const [{ data: ratings }, { data: comments }] = await Promise.all([
        adminSupabase.from('lp_ratings').select('user_id').in('user_id', ids),
        adminSupabase.from('comments').select('user_id').in('user_id', ids),
      ]);

      const ratingMap = new Map<string, number>();
      (ratings || []).forEach((r: any) => ratingMap.set(r.user_id, (ratingMap.get(r.user_id) || 0) + 1));
      const commentMap = new Map<string, number>();
      (comments || []).forEach((c: any) => {
        if (c.user_id) commentMap.set(c.user_id, (commentMap.get(c.user_id) || 0) + 1);
      });

      const merged: MemberRow[] = (profiles || []).map(p => ({
        ...p,
        rating_count: ratingMap.get(p.id) || 0,
        comment_count: commentMap.get(p.id) || 0,
      }));
      setRows(merged);
    } catch (err: any) {
      toast.error(err?.message || '회원 목록 로드 실패');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(m =>
      m.display_name?.toLowerCase().includes(q) || m.id.includes(q)
    );
  }, [rows, filter]);

  const handleAdjustReputation = async (id: string, delta: number) => {
    try {
      const res = await fetchAdminApi('adjustReputation', { id, delta });
      const next = res?.data?.reputation;
      setRows(rows.map(r => (r.id === id && typeof next === 'number' ? { ...r, reputation: next } : r)));
      toast.success(`Reputation ${delta > 0 ? '+' : ''}${delta}`);
    } catch (err: any) {
      toast.error(err?.message || '실패');
    }
  };

  const handleToggleProtected = async (m: MemberRow) => {
    try {
      const res = await fetchAdminApi('updateProfile', { id: m.id, data: { is_protected: !m.is_protected } });
      const next = res?.data?.is_protected;
      setRows(rows.map(r => (r.id === m.id && typeof next === 'boolean' ? { ...r, is_protected: next } : r)));
      toast.success(`Protected ${next ? 'on' : 'off'}`);
    } catch (err: any) {
      toast.error(err?.message || '실패');
    }
  };

  const handleDelete = async (m: MemberRow) => {
    if (!confirm(`${m.display_name || m.id}을(를) 영구 삭제할까요?\n별점/업적/댓글 매핑도 함께 정리됩니다.`)) return;
    try {
      await fetchAdminApi('deleteUser', { id: m.id });
      setRows(rows.filter(r => r.id !== m.id));
      toast.success('회원 삭제됨');
    } catch (err: any) {
      toast.error(err?.message || '삭제 실패');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="전체 회원" value={rows.length.toLocaleString()} />
        <StatCard
          label="평균 Reputation"
          value={(rows.length ? rows.reduce((s, r) => s + r.reputation, 0) / rows.length : 0).toFixed(1)}
        />
        <StatCard
          label="Protected"
          value={rows.filter(r => r.is_protected).length.toLocaleString()}
        />
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="이름 / ID 검색..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <Button onClick={fetchMembers} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">회원 목록 ({filtered.length})</h3>
        </div>
        <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-500">불러오는 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">회원이 없습니다</p>
            </div>
          ) : (
            filtered.map(m => (
              <div key={m.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                <div className="flex-shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                      {(m.display_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.display_name || '(이름 없음)'}</p>
                  <p className="text-xs text-gray-500 truncate font-mono">{m.id}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    별점 {m.rating_count} · 댓글 {m.comment_count} · 가입 {new Date(m.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">REP</p>
                    <p className="text-lg font-bold text-gray-900 tabular-nums">{m.reputation}</p>
                  </div>
                  <div className="flex items-center">
                    <Button onClick={() => handleAdjustReputation(m.id, -10)} variant="ghost" size="sm" title="−10">
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <Button onClick={() => handleAdjustReputation(m.id, 10)} variant="ghost" size="sm" title="+10">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleToggleProtected(m)}
                    variant="ghost"
                    size="sm"
                    title={m.is_protected ? 'Protected 해제' : 'Protected 부여'}
                    className={m.is_protected ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}
                  >
                    {m.is_protected ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={() => handleDelete(m)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="회원 삭제"
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}
