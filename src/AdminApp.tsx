import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, RefreshCw, AlertTriangle, CheckCircle, LogOut, Music2, Heart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { supabase, type Comment } from './lib/supabase';
import { toast, Toaster } from 'sonner';
import { LpMarketAdmin } from '../components/admin/LpMarketAdmin';
import { RatingsAdmin } from '../components/admin/RatingsAdmin';
import { MembersAdmin } from '../components/admin/MembersAdmin';

export function AdminApp() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0, totalLikes: 0 });
  const [filterTrack, setFilterTrack] = useState('');
  const [activeView, setActiveView] = useState<'board' | 'market' | 'ratings' | 'members'>('board');

// 관리자 API 호출 헬퍼 — 서버에서 발급받은 토큰을 사용
const fetchAdminApi = async (action: string, payload: any) => {
  const token = sessionStorage.getItem('admin_token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch('/api/admin/db', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ action, payload })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    // 토큰 만료 시 자동 로그아웃
    if (res.status === 401) {
      sessionStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_token');
      window.location.reload();
    }
    throw new Error(errorData?.error || `API Error: ${res.status}`);
  }
  
  return res.json();
};

  // Check if already authenticated (토큰이 유효한지도 확인)
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    const token = sessionStorage.getItem('admin_token');
    if (auth === 'true' && token) {
      setIsAuthenticated(true);
      fetchComments();
    }
  }, []);

  const handleAuth = async () => {
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          // 로컬 개발 환경: API 없으면 클라이언트 비밀번호 비교
          const localPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
          if (password === localPassword) {
            setIsAuthenticated(true);
            sessionStorage.setItem('admin_auth', 'true');
            toast.success('로컬 인증 성공');
            fetchComments();
          } else {
            toast.error('비밀번호가 틀렸습니다');
          }
          return;
        }
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Authentication failed');
        return;
      }

      const data = await res.json();
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
      sessionStorage.setItem('admin_token', data.token);
      toast.success('Authenticated successfully');
      fetchComments();
    } catch {
      // 로컬 개발 환경: API 없으면 클라이언트 비밀번호 비교
      const localPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
      if (password === localPassword) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_auth', 'true');
        toast.success('로컬 인증 성공');
        fetchComments();
      } else {
        toast.error('Endpoint not found');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('admin_token');
    setPassword('');
    toast.info('Logged out');
  };

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setComments(data);
        
        // Calculate stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayComments = data.filter(c => 
          new Date(c.created_at) >= today
        );
        const totalLikes = data.reduce((sum, c) => sum + c.likes, 0);
        
        setStats({
          total: data.length,
          today: todayComments.length,
          totalLikes
        });
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await fetchAdminApi('deleteComment', { id: commentId });

      setComments(comments.filter(c => c.id !== commentId));
      setStats(prev => ({ 
        ...prev, 
        total: prev.total - 1,
        totalLikes: prev.totalLikes - (comments.find(c => c.id === commentId)?.likes || 0)
      }));
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ DELETE ALL COMMENTS? This cannot be undone!')) return;
    if (!confirm('⚠️ FINAL WARNING: Permanently delete all comments?')) return;

    try {
      await fetchAdminApi('deleteAllComments', {});

      setComments([]);
      setStats({ total: 0, today: 0, totalLikes: 0 });
      toast.success('All comments deleted');
    } catch (error) {
      console.error('Error deleting all comments:', error);
      toast.error('Failed to delete comments');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredComments = filterTrack
    ? comments.filter(c => 
        c.author?.toLowerCase().includes(filterTrack.toLowerCase()) ||
        c.message?.toLowerCase().includes(filterTrack.toLowerCase())
      )
    : comments;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">It's My Turn - Community Board Management</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              
              <Button
                onClick={handleAuth}
                className="w-full bg-red-600 hover:bg-red-700 py-3 text-base font-medium"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Sign In
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                🔒 Secure access required
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">🛡️ Admin</h1>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Community Board Management</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="text-gray-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveView('board')}
            className={`rounded-2xl px-4 py-2 text-sm ${
              activeView === 'board'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            커뮤니티 관리
          </button>
          <button
            onClick={() => setActiveView('market')}
            className={`rounded-2xl px-4 py-2 text-sm ${
              activeView === 'market'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            LP 데이터
          </button>
          <button
            onClick={() => setActiveView('ratings')}
            className={`rounded-2xl px-4 py-2 text-sm ${
              activeView === 'ratings'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            별점 관리
          </button>
          <button
            onClick={() => setActiveView('members')}
            className={`rounded-2xl px-4 py-2 text-sm ${
              activeView === 'members'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            회원 관리
          </button>
        </div>

        {activeView === 'ratings' ? (
          <RatingsAdmin />
        ) : activeView === 'members' ? (
          <MembersAdmin />
        ) : activeView === 'board' ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Comments</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Music2 className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Today</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{stats.today}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Likes</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">{stats.totalLikes}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actions Bar */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex-1 w-full sm:w-auto">
                  <input
                    type="text"
                    value={filterTrack}
                    onChange={(e) => setFilterTrack(e.target.value)}
                    placeholder="Filter by author or message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={fetchComments}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    onClick={handleDeleteAll}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Comments List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-900">
                  Comments ({filteredComments.length})
                </h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {isLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
                    <p className="text-sm text-gray-500">Loading comments...</p>
                  </div>
                ) : filteredComments.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">
                      {filterTrack ? 'No comments match your filter' : 'No comments found'}
                    </p>
                  </div>
                ) : (
                  filteredComments.map((comment) => (
                    <div key={comment.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                              {comment.author[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{comment.author}</p>
                              <p className="text-xs text-gray-500">{formatDate(comment.created_at)}</p>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mb-2">
                            {comment.message}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Heart className={`w-3 h-3 ${comment.likes > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                              {comment.likes}
                            </span>
                            <span className="font-mono">ID: {comment.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleDelete(comment.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : activeView === 'market' ? (
          <LpMarketAdmin />
        ) : null}
      </div>
    </div>
  );
}

