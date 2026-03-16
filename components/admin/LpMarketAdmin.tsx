
import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';
import { LP_VENDOR_CHANNELS } from '../../src/data/lpMarket';
import { X, RefreshCw, Plus, ArrowUp, Combine, Trash2, Download } from 'lucide-react';

// Admin 전용 Supabase 클라이언트 (Service Role Key → RLS 우회 불가)
// 보안 서명: VITE_SUPABASE_SERVICE_ROLE_KEY는 프론트엔드에 노출되므로 절대 사용하면 안 됩니다.
const adminSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY, /* Anon Key 사용 필수 */
  { auth: { persistSession: false } }
);

const DISCOGS_TOKEN = import.meta.env.VITE_DISCOGS_TOKEN;

// ── 타입 ────────────────────────────────────────
interface TrackItem {
  position: string;
  title: string;
  duration: string;
}

interface DbProduct {
  id: string;
  ean?: string | null;
  title: string;
  artist: string;
  release_date?: string | null;
  label?: string | null;
  cover?: string | null;
  thumbnail_url?: string | null;
  format?: string | null;
  genres?: string[] | null;
  styles?: string[] | null;
  track_list?: TrackItem[] | null;
  discogs_id?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  last_synced_at?: string | null;
  offers?: DbOffer[];
}

interface DbOffer {
  id: string;
  product_id: string;
  vendor_name: string;
  channel_id: string;
  price: number;
  base_price?: number | null;
  currency: string;
  shipping_fee: number;
  shipping_policy?: string | null;
  url: string;
  affiliate_url?: string | null;
  is_stock_available: boolean;
  badge?: 'fresh' | 'lowest' | 'exclusive' | 'best' | null;
  last_checked?: string;
  created_at?: string;
  updated_at?: string;
}

// ── 기본값 ──────────────────────────────────────
const createBlankProduct = (): DbProduct => ({
  id: '', title: '', artist: '', ean: '', discogs_id: '',
  label: '', format: 'Vinyl', release_date: '', cover: '',
  thumbnail_url: '', genres: [], styles: [], track_list: [], description: '', offers: [],
});

const createBlankOffer = (productId: string): DbOffer => ({
  id: '', product_id: productId, vendor_name: '', channel_id: 'mega-book',
  price: 0, base_price: 0, currency: 'KRW', shipping_fee: 0,
  shipping_policy: '', url: '', affiliate_url: '',
  is_stock_available: true, badge: null,
});

const createBlankTrack = (): TrackItem => ({ position: '', title: '', duration: '' });

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Math.round(v));

// ── Discogs EAN → 트랙리스트 + 메타데이터 ────────
async function fetchDiscogsDataByEan(ean: string): Promise<{
  tracks: TrackItem[];
  title?: string;
  artist?: string;
  label?: string;
  releaseDate?: string;
  cover?: string;
  discogsId?: string;
  genres?: string[];
  styles?: string[];
} | null> {
  if (!DISCOGS_TOKEN) throw new Error('VITE_DISCOGS_TOKEN이 설정되지 않았습니다.');
  const cleanEan = ean.replace(/[^0-9]/g, '');
  if (!cleanEan) throw new Error('유효한 EAN이 아닙니다.');

  // 1) 바코드로 검색
  const searchRes = await fetch(
    `https://api.discogs.com/database/search?barcode=${cleanEan}&type=release&per_page=5`,
    { headers: { 'Authorization': `Discogs token=${DISCOGS_TOKEN}`, 'User-Agent': 'ItsmyturnAdmin/1.0' } }
  );
  if (!searchRes.ok) throw new Error(`Discogs 검색 실패: ${searchRes.status}`);
  const searchData = await searchRes.json();

  if (!searchData.results?.length) {
    throw new Error(`EAN ${cleanEan}에 해당하는 Discogs 릴리즈를 찾을 수 없습니다.`);
  }

  // Vinyl 우선, 없으면 첫 번째 결과 사용
  const result = searchData.results.find((r: any) => r.format?.some((f: string) => f.toLowerCase().includes('vinyl')))
    || searchData.results[0];

  // 2) 릴리즈 상세 가져오기
  const releaseRes = await fetch(
    result.resource_url,
    { headers: { 'Authorization': `Discogs token=${DISCOGS_TOKEN}`, 'User-Agent': 'ItsmyturnAdmin/1.0' } }
  );
  if (!releaseRes.ok) throw new Error(`릴리즈 상세 가져오기 실패: ${releaseRes.status}`);
  const release = await releaseRes.json();

  // 트랙리스트 변환
  const tracks: TrackItem[] = (release.tracklist || [])
    .filter((t: any) => t.type_ !== 'heading')
    .map((t: any) => ({
      position: t.position || '',
      title: t.title || '',
      duration: t.duration || '',
    }));

  // 아티스트 추출
  const artist = release.artists?.map((a: any) => a.name.replace(/\s*\(\d+\)\s*$/, '')).join(', ') || result.title?.split(' - ')[0] || '';

  // 레이블 추출
  const label = release.labels?.[0]?.name || '';

  // 커버 이미지
  const cover = release.images?.find((img: any) => img.type === 'primary')?.uri || release.images?.[0]?.uri || result.cover_image || '';

  return {
    tracks,
    title: release.title || result.title?.split(' - ').slice(1).join(' - ') || '',
    artist,
    label,
    releaseDate: release.released || release.year?.toString() || '',
    cover,
    discogsId: String(release.id),
    genres: release.genres || [],
    styles: release.styles || [],
  };
}

// ── 스크롤 탑 훅 ──────────────────────────────────
function useScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return { visible, scrollTop };
}

// ── 메인 컴포넌트 ────────────────────────────────
export function LpMarketAdmin() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 편집 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DbProduct>(createBlankProduct());
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingDiscogs, setIsFetchingDiscogs] = useState(false);

  // 합치기 기능
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  // 스크롤 탑
  const { visible: showScrollTop, scrollTop } = useScrollToTop();
  const topRef = useRef<HTMLDivElement>(null);

  // ── 데이터 로드 ──────────────────────────────
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await adminSupabase
        .from('lp_products')
        .select('*, offers:lp_offers(*)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setProducts(data || []);
    } catch {
      toast.error('상품 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── Discogs 자동 가져오기 ─────────────────────
  const handleFetchDiscogs = async () => {
    const ean = draft.ean?.trim();
    if (!ean) { toast.error('EAN을 먼저 입력하세요.'); return; }
    setIsFetchingDiscogs(true);
    try {
      const result = await fetchDiscogsDataByEan(ean);
      if (!result) return;

      const applyAll = result.tracks.length > 0;
      setDraft((prev) => ({
        ...prev,
        track_list: applyAll ? result.tracks : prev.track_list,
        title: prev.title || result.title || prev.title,
        artist: prev.artist || result.artist || prev.artist,
        label: prev.label || result.label || prev.label,
        release_date: prev.release_date || result.releaseDate || prev.release_date,
        cover: prev.cover || result.cover || prev.cover,
        discogs_id: prev.discogs_id || result.discogsId || prev.discogs_id,
        genres: (prev.genres?.length ? prev.genres : result.genres) ?? prev.genres,
        styles: (prev.styles?.length ? prev.styles : result.styles) ?? prev.styles,
      }));

      toast.success(`Discogs에서 ${result.tracks.length}개 트랙을 가져왔습니다. (Discogs ID: ${result.discogsId})`);
    } catch (err) {
      toast.error(`Discogs 가져오기 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setIsFetchingDiscogs(false);
    }
  };

  // ── 편집 모달 ────────────────────────────────
  const openProduct = (product: DbProduct) => {
    setDraft(JSON.parse(JSON.stringify(product)));
    setIsNewProduct(false);
    setModalOpen(true);
  };

  const openNew = () => {
    setDraft(createBlankProduct());
    setIsNewProduct(true);
    setModalOpen(true);
  };

  // ── 저장 ────────────────────────────────────
  const handleSave = async () => {
    if (!draft.title.trim()) { toast.error('상품명은 필수입니다.'); return; }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const productPayload: Record<string, unknown> = {
        title: draft.title, artist: draft.artist, ean: draft.ean || null,
        discogs_id: draft.discogs_id || null, label: draft.label || null,
        format: draft.format || null, release_date: draft.release_date || null,
        cover: draft.cover || null, thumbnail_url: draft.thumbnail_url || null,
        genres: draft.genres?.length ? draft.genres : null,
        styles: draft.styles?.length ? draft.styles : null,
        track_list: draft.track_list?.length ? draft.track_list : null,
        description: draft.description || null, updated_at: now,
      };

      let savedId = draft.id;
      if (isNewProduct || !draft.id) {
        const { data, error } = await adminSupabase
          .from('lp_products').insert({ ...productPayload, created_at: now }).select('id').single();
        if (error) throw error;
        savedId = data.id;
        toast.success('새 상품이 추가되었습니다.');
      } else {
        const { error } = await adminSupabase.from('lp_products').update(productPayload).eq('id', draft.id);
        if (error) throw error;
        toast.success('상품 정보가 저장되었습니다.');
      }

      for (const offer of draft.offers || []) {
        const offerPayload: Record<string, unknown> = {
          product_id: savedId, vendor_name: offer.vendor_name,
          channel_id: offer.channel_id, price: offer.price || 0,
          base_price: offer.base_price || null, currency: offer.currency || 'KRW',
          shipping_fee: offer.shipping_fee || 0, shipping_policy: offer.shipping_policy || null,
          url: offer.url || '', affiliate_url: offer.affiliate_url || null,
          is_stock_available: offer.is_stock_available, badge: offer.badge || null,
          last_checked: now, updated_at: now,
        };
        if (!offer.id) {
          await adminSupabase.from('lp_offers').insert({ ...offerPayload, created_at: now });
        } else {
          await adminSupabase.from('lp_offers').update(offerPayload).eq('id', offer.id);
        }
      }

      await fetchProducts();
      setModalOpen(false);
    } catch (err) {
      toast.error(`저장 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 삭제 ────────────────────────────────────
  const handleDelete = async () => {
    if (!draft.id || isNewProduct) return;
    if (!confirm(`"${draft.title}" 을(를) 삭제하시겠습니까?`)) return;
    try {
      await adminSupabase.from('lp_offers').delete().eq('product_id', draft.id);
      const { error } = await adminSupabase.from('lp_products').delete().eq('id', draft.id);
      if (error) throw error;
      toast.success('삭제되었습니다.');
      setModalOpen(false);
      await fetchProducts();
    } catch (err) {
      toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Offer 삭제 ───────────────────────────────
  const handleDeleteOffer = async (offer: DbOffer, index: number) => {
    if (offer.id) await adminSupabase.from('lp_offers').delete().eq('id', offer.id);
    setDraft((prev) => ({ ...prev, offers: (prev.offers || []).filter((_, i) => i !== index) }));
  };

  // ── 트랙 리스트 조작 ─────────────────────────
  const addTrack = () =>
    setDraft((prev) => ({ ...prev, track_list: [...(prev.track_list || []), createBlankTrack()] }));

  const removeTrack = (index: number) =>
    setDraft((prev) => ({ ...prev, track_list: (prev.track_list || []).filter((_, i) => i !== index) }));

  const setTrackField = (index: number, field: keyof TrackItem, value: string) =>
    setDraft((prev) => {
      const tracks = [...(prev.track_list || [])];
      tracks[index] = { ...tracks[index], [field]: value };
      return { ...prev, track_list: tracks };
    });

  // ── 합치기 ───────────────────────────────────
  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  const openMergeModal = () => {
    if (selectedIds.size < 2) { toast.error('2개 이상의 상품을 선택하세요.'); return; }
    setPrimaryId(selectedProducts[0].id);
    setMergeModalOpen(true);
  };

  const handleMerge = async () => {
    if (!primaryId) { toast.error('기준 상품을 선택하세요.'); return; }
    const secondaries = selectedProducts.filter((p) => p.id !== primaryId);
    if (secondaries.length === 0) return;

    setIsMerging(true);
    try {
      const now = new Date().toISOString();
      for (const sec of secondaries) {
        const { error: updateErr } = await adminSupabase
          .from('lp_offers')
          .update({ product_id: primaryId, updated_at: now })
          .eq('product_id', sec.id);

        if (updateErr) {
          await adminSupabase.from('lp_offers').delete().eq('product_id', sec.id);
        }

        const { error: deleteErr } = await adminSupabase
          .from('lp_products').delete().eq('id', sec.id);

        if (deleteErr) throw new Error(`"${sec.title}" 삭제 실패: ${deleteErr.message}`);
      }

      toast.success(`${secondaries.length}개 상품이 합쳐졌습니다.`);
      setMergeModalOpen(false);
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (err) {
      toast.error(`합치기 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setIsMerging(false);
    }
  };

  // ── 체크박스 토글 ─────────────────────────────
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const setField = <K extends keyof DbProduct>(field: K, value: DbProduct[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const setOfferField = <K extends keyof DbOffer>(index: number, field: K, value: DbOffer[K]) =>
    setDraft((prev) => {
      const offers = [...(prev.offers || [])];
      offers[index] = { ...offers[index], [field]: value };
      return { ...prev, offers };
    });

  const filtered = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.artist?.toLowerCase().includes(q)
      || p.ean?.toLowerCase().includes(q) || p.discogs_id?.toLowerCase().includes(q);
  });

  return (
    <>
      {/* ── 리스트 뷰 ── */}
      <div ref={topRef} className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl text-slate-900">LP 데이터 관리</h2>
            <p className="text-sm text-gray-500">상품을 클릭하면 편집 모달이 열립니다. 체크박스로 여러 상품을 선택해 합칠 수 있습니다.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedIds.size >= 2 && (
              <Button variant="outline" className="rounded-2xl border-amber-300 text-amber-700 hover:bg-amber-50" onClick={openMergeModal}>
                <Combine className="w-4 h-4 mr-1.5" />
                {selectedIds.size}개 합치기
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button variant="outline" className="rounded-2xl text-slate-500" onClick={() => setSelectedIds(new Set())}>선택 해제</Button>
            )}
            <Button variant="outline" className="rounded-2xl border-slate-200" onClick={fetchProducts} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? '로딩 중' : '새로고침'}
            </Button>
            <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1.5" />새 상품
            </Button>
          </div>
        </div>

        <input
          type="text"
          placeholder="제목 / 아티스트 / EAN / Discogs ID 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        {selectedIds.size > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between">
            <span>{selectedIds.size}개 선택됨 — 2개 이상 선택 시 합치기 가능</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-amber-500 hover:text-amber-700 text-xs">선택 해제</button>
          </div>
        )}

        <p className="text-xs text-slate-400">{filtered.length}개 상품</p>

        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(filtered.map((p) => p.id)));
                      else setSelectedIds(new Set());
                    }}
                    className="w-4 h-4 rounded accent-slate-700 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium w-12">#</th>
                <th className="px-4 py-3 text-left font-medium">커버</th>
                <th className="px-4 py-3 text-left font-medium">상품명</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">아티스트</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Discogs ID</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">EAN</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">판매처</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-16 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />로딩 중...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-slate-400">상품 없음</td></tr>
              ) : (
                filtered.map((product, i) => {
                  const isSelected = selectedIds.has(product.id);
                  return (
                    <tr key={product.id} onClick={() => openProduct(product)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-3" onClick={(e) => toggleSelect(product.id, e)}>
                        <input type="checkbox" checked={isSelected} onChange={() => {}}
                          className="w-4 h-4 rounded accent-slate-700 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        {product.cover
                          ? <img src={product.cover} alt={product.title} className="w-10 h-10 object-cover rounded-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xs">LP</div>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 truncate max-w-[200px]">{product.title || '—'}</div>
                        <div className="text-xs text-slate-400 md:hidden">{product.artist}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell truncate max-w-[150px]">{product.artist || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell font-mono">{product.discogs_id || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell font-mono">{product.ean || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          (product.offers?.length ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>{product.offers?.length ?? 0}개</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 플로팅 버튼 ── */}
      {showScrollTop && (
        <div className="fixed bottom-8 right-8 z-40 flex items-center gap-2" style={{ animation: 'fadeInUp 0.2s ease' }}>
          {selectedIds.size >= 2 && (
            <button onClick={openMergeModal}
              className="flex items-center gap-1.5 h-12 px-4 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-400 transition-all text-sm font-medium">
              <Combine className="w-4 h-4 shrink-0" />{selectedIds.size}개 합치기
            </button>
          )}
          <button onClick={scrollTop}
            className="w-12 h-12 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-700 transition-all flex items-center justify-center"
            title="맨 위로">
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── 합치기 모달 ── */}
      {mergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">앨범 합치기</h3>
                <p className="text-xs text-slate-400">기준 상품을 선택하세요. 나머지 상품의 판매처가 기준 상품으로 이전된 후 삭제됩니다.</p>
              </div>
              <button onClick={() => setMergeModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {selectedProducts.map((p) => (
                <label key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  primaryId === p.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input type="radio" name="primary" value={p.id} checked={primaryId === p.id}
                    onChange={() => setPrimaryId(p.id)} className="accent-slate-700 shrink-0" />
                  {p.cover && <img src={p.cover} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{p.title}</div>
                    <div className="text-xs text-slate-500 truncate">{p.artist}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 flex gap-2">
                      {p.discogs_id && <span>Discogs: {p.discogs_id}</span>}
                      {p.ean && <span>EAN: {p.ean}</span>}
                      <span className="text-green-600">판매처 {p.offers?.length ?? 0}개</span>
                    </div>
                  </div>
                  {primaryId === p.id && <span className="ml-auto shrink-0 rounded-full bg-slate-900 text-white text-xs px-2 py-0.5">기준</span>}
                </label>
              ))}
            </div>
            <div className="px-6 pb-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 mb-4">
                ⚠️ 기준이 아닌 {selectedProducts.length - 1}개 상품은 DB에서 영구 삭제됩니다.
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="rounded-2xl" onClick={() => setMergeModalOpen(false)}>취소</Button>
                <Button className="rounded-2xl bg-amber-600 text-white hover:bg-amber-700" onClick={handleMerge} disabled={isMerging || !primaryId}>
                  {isMerging ? '합치는 중...' : `합치기 (${selectedProducts.length}개)`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 편집 모달 ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {isNewProduct ? '새 상품 추가' : draft.title || '상품 편집'}
                </h3>
                {!isNewProduct && draft.discogs_id && (
                  <p className="text-xs text-slate-400 font-mono">Discogs: {draft.discogs_id}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isNewProduct && draft.id && (
                  <Button variant="outline" size="sm" className="rounded-2xl text-rose-600 border-rose-200 hover:bg-rose-50" onClick={handleDelete}>삭제</Button>
                )}
                <Button size="sm" className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 바디 */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Discogs 자동 가져오기 배너 */}
              <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-indigo-800">Discogs에서 자동 가져오기</p>
                  <p className="text-xs text-indigo-500 mt-0.5">EAN 입력 후 버튼을 누르면 트랙리스트, 장르, 커버 등을 자동으로 채웁니다.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-indigo-300 text-indigo-700 hover:bg-indigo-100 shrink-0"
                  onClick={handleFetchDiscogs}
                  disabled={isFetchingDiscogs || !draft.ean?.trim()}
                >
                  {isFetchingDiscogs ? (
                    <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />가져오는 중...</>
                  ) : (
                    <><Download className="w-4 h-4 mr-1.5" />Discogs 가져오기</>
                  )}
                </Button>
              </div>

              {isNewProduct && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
                  ✨ 새 상품 추가 모드
                </div>
              )}

              <Section title="기본 정보">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField label="상품명 *" value={draft.title} onChange={(e) => setField('title', e.target.value)} />
                  <InputField label="아티스트" value={draft.artist} onChange={(e) => setField('artist', e.target.value)} />
                  <InputField label="레이블" value={draft.label ?? ''} onChange={(e) => setField('label', e.target.value)} />
                  <InputField label="포맷" value={draft.format ?? ''} onChange={(e) => setField('format', e.target.value)} placeholder="Vinyl, CD ..." />
                  <InputField label="발매일 (YYYY-MM-DD)" value={draft.release_date ?? ''} onChange={(e) => setField('release_date', e.target.value)} placeholder="2024-01-01" />
                </div>
              </Section>

              <Section title="식별자">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField label="EAN / 바코드" value={draft.ean ?? ''} onChange={(e) => setField('ean', e.target.value)} />
                  <InputField label="Discogs ID" value={draft.discogs_id ?? ''} onChange={(e) => setField('discogs_id', e.target.value)} />
                </div>
              </Section>

              <Section title="이미지 URL">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField label="커버 이미지 URL" value={draft.cover ?? ''} onChange={(e) => setField('cover', e.target.value)} />
                  <InputField label="썸네일 URL" value={draft.thumbnail_url ?? ''} onChange={(e) => setField('thumbnail_url', e.target.value)} />
                </div>
                {draft.cover && (
                  <img src={draft.cover} alt="cover" className="w-16 h-16 object-cover rounded-lg border mt-2"
                    onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
              </Section>

              <Section title="장르 / 스타일">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TagInputField label="Genres (쉼표 구분)" values={draft.genres ?? []} onChange={(vals) => setField('genres', vals)} />
                  <TagInputField label="Styles (쉼표 구분)" values={draft.styles ?? []} onChange={(vals) => setField('styles', vals)} />
                </div>
              </Section>

              {/* ── 트랙 리스트 ── */}
              <Section
                title={`트랙 리스트 · ${draft.track_list?.length ?? 0}곡`}
                action={
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl text-xs h-8 px-3 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                      onClick={handleFetchDiscogs}
                      disabled={isFetchingDiscogs || !draft.ean?.trim()}
                      title="EAN으로 Discogs에서 트랙 가져오기"
                    >
                      {isFetchingDiscogs
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <><Download className="w-3 h-3 mr-1" />Discogs</>
                      }
                    </Button>
                    <Button variant="outline" className="rounded-2xl text-xs h-8 px-3" onClick={addTrack}>
                      + 트랙 추가
                    </Button>
                  </div>
                }
              >
                {(!draft.track_list || draft.track_list.length === 0) && (
                  <p className="text-sm text-slate-400 py-3 text-center">
                    트랙 정보가 없습니다.
                    {draft.ean?.trim() && <span className="text-indigo-500 ml-1 cursor-pointer" onClick={handleFetchDiscogs}> → Discogs에서 가져오기</span>}
                  </p>
                )}
                <div className="space-y-2">
                  {(draft.track_list || []).map((track, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2">
                      <span className="text-xs text-slate-400 w-5 shrink-0 text-center">{idx + 1}</span>
                      <input
                        type="text" value={track.position}
                        onChange={(e) => setTrackField(idx, 'position', e.target.value)}
                        placeholder="A1"
                        className="w-12 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 text-center"
                      />
                      <input
                        type="text" value={track.title}
                        onChange={(e) => setTrackField(idx, 'title', e.target.value)}
                        placeholder="트랙 제목"
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                      />
                      <input
                        type="text" value={track.duration}
                        onChange={(e) => setTrackField(idx, 'duration', e.target.value)}
                        placeholder="3:45"
                        className="w-16 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 text-center"
                      />
                      <button onClick={() => removeTrack(idx)} className="shrink-0 text-slate-400 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="설명">
                <InputField label="Description" value={draft.description ?? ''} onChange={(e) => setField('description', e.target.value)} textarea />
              </Section>

              <Section
                title={`판매처 (lp_offers) · ${draft.offers?.length ?? 0}개`}
                action={
                  <Button variant="outline" className="rounded-2xl text-xs h-8 px-3" onClick={() =>
                    setDraft((prev) => ({ ...prev, offers: [...(prev.offers || []), createBlankOffer(prev.id)] }))
                  }>
                    + 판매처 추가
                  </Button>
                }
              >
                {(!draft.offers || draft.offers.length === 0) && (
                  <p className="text-sm text-slate-400 py-4 text-center">등록된 판매처가 없습니다.</p>
                )}
                <div className="space-y-4">
                  {(draft.offers || []).map((offer, idx) => (
                    <div key={offer.id || `new-${idx}`} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">
                          {offer.vendor_name || '판매처 미입력'} · {formatCurrency((offer.price || 0) + (offer.shipping_fee || 0))}
                        </span>
                        <div className="flex gap-2">
                          {!offer.id && <span className="text-blue-500">NEW</span>}
                          <button onClick={() => handleDeleteOffer(offer, idx)} className="text-rose-500 hover:text-rose-600">삭제</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField label="판매처명" value={offer.vendor_name} onChange={(e) => setOfferField(idx, 'vendor_name', e.target.value)} />
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-gray-500">채널</label>
                          <select value={offer.channel_id} onChange={(e) => setOfferField(idx, 'channel_id', e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none">
                            {LP_VENDOR_CHANNELS.map((ch) => <option key={ch.id} value={ch.id}>{ch.label}</option>)}
                          </select>
                        </div>
                        <InputField label="판매가" type="number" value={(offer.price ?? 0).toString()} onChange={(e) => setOfferField(idx, 'price', Number(e.target.value) || 0)} />
                        <InputField label="기준가" type="number" value={(offer.base_price ?? 0).toString()} onChange={(e) => setOfferField(idx, 'base_price', Number(e.target.value) || 0)} />
                        <InputField label="배송비" type="number" value={(offer.shipping_fee ?? 0).toString()} onChange={(e) => setOfferField(idx, 'shipping_fee', Number(e.target.value) || 0)} />
                        <InputField label="배송 정책" value={offer.shipping_policy ?? ''} onChange={(e) => setOfferField(idx, 'shipping_policy', e.target.value)} placeholder="3만원 이상 무료" />
                        <InputField label="구매 링크" value={offer.url} onChange={(e) => setOfferField(idx, 'url', e.target.value)} />
                        <InputField label="어필리에이트 URL" value={offer.affiliate_url ?? ''} onChange={(e) => setOfferField(idx, 'affiliate_url', e.target.value)} />
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-gray-500">재고</label>
                          <select value={offer.is_stock_available ? 'true' : 'false'} onChange={(e) => setOfferField(idx, 'is_stock_available', e.target.value === 'true')}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none">
                            <option value="true">재고 있음</option>
                            <option value="false">품절</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-gray-500">뱃지</label>
                          <select value={offer.badge ?? ''} onChange={(e) => setOfferField(idx, 'badge', (e.target.value as DbOffer['badge']) || null)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none">
                            <option value="">없음</option>
                            <option value="fresh">fresh</option>
                            <option value="lowest">lowest</option>
                            <option value="exclusive">exclusive</option>
                            <option value="best">best</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

interface InputFieldProps {
  label: string; value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  textarea?: boolean; type?: string; placeholder?: string;
}

function InputField({ label, value, onChange, textarea, type = 'text', placeholder }: InputFieldProps) {
  const cls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 bg-white';
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="text-gray-500">{label}</label>
      {textarea
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} className={`${cls} min-h-[80px] resize-y`} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={cls} />
      }
    </div>
  );
}

function TagInputField({ label, values, onChange }: { label: string; values: string[]; onChange: (vals: string[]) => void }) {
  const [raw, setRaw] = useState(values.join(', '));
  useEffect(() => { setRaw(values.join(', ')); }, [values]);
  const handleBlur = () => onChange(raw.split(',').map((s) => s.trim()).filter(Boolean));
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="text-gray-500">{label}</label>
      <input type="text" value={raw} onChange={(e) => setRaw(e.target.value)} onBlur={handleBlur}
        placeholder="Rock, Pop, Jazz ..."
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 bg-white" />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {values.map((v) => <span key={v} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{v}</span>)}
        </div>
      )}
    </div>
  );
}
