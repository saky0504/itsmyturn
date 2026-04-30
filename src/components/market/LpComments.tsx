import { useState, useEffect } from 'react';
import { Send, ChevronUp, ChevronDown, RefreshCw, Pencil, ShieldCheck } from 'lucide-react';
import { supabase, type Comment } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface LpCommentsProps {
  productId: string;
  productTitle: string;
  productArtist: string;
}

type CommentWithScore = Comment & { score?: number };
type VoteValue = -1 | 1;

export function LpComments({ productId, productTitle, productArtist }: LpCommentsProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentWithScore[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, VoteValue>>({});
  const [newComment, setNewComment] = useState('');
  const [username, setUsername] = useState('');
  const [showUsernameInput, setShowUsernameInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 로그인 사용자: 닉네임은 프로필 표시명으로 자동 세팅 + 입력 숨김
  const loggedInName = profile?.display_name || user?.email?.split('@')[0] || null;

  useEffect(() => {
    if (loggedInName) {
      setUsername(loggedInName);
      setShowUsernameInput(false);
      return;
    }
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setUsername(savedUsername);
      setShowUsernameInput(false);
    }
  }, [loggedInName]);

  const fetchComments = async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('track_id', productId)
        .order('score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching comments:', error);
        setComments([]);
        return;
      }

      const list = (data ?? []) as CommentWithScore[];
      setComments(list);

      // 본인 투표 상태 동시에 가져오기
      if (user && list.length > 0) {
        const ids = list.map(c => c.id);
        const { data: votes } = await supabase
          .from('comment_votes')
          .select('comment_id, value')
          .in('comment_id', ids)
          .eq('user_id', user.id);
        const map: Record<string, VoteValue> = {};
        (votes || []).forEach((v: { comment_id: string; value: VoteValue }) => {
          map[v.comment_id] = v.value;
        });
        setMyVotes(map);
      } else {
        setMyVotes({});
      }
    } catch (error: unknown) {
      console.error('Error:', error);
      setComments([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user?.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`lp-comments-${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `track_id=eq.${productId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setComments(prev => [payload.new as Comment, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setComments(prev =>
              prev.map(c => c.id === payload.new.id ? payload.new as Comment : c)
            );
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  const handleSetUsername = () => {
    if (username.trim()) {
      localStorage.setItem('username', username.trim());
      setShowUsernameInput(false);
      toast.success(`환영합니다, ${username.trim()}님!`);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    if (!username.trim() && !showUsernameInput) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            author: username || 'Anonymous',
            message: newComment.trim(),
            track_id: productId,
            track_title: productTitle,
            track_artist: productArtist,
            user_id: user?.id ?? null,
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error posting comment:', error);
        toast.error('댓글 작성에 실패했습니다');
        return;
      }

      if (data) {
        setNewComment('');
        toast.success('댓글이 작성되었습니다');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('댓글 작성에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (commentId: string, next: VoteValue) => {
    if (!user) {
      toast.info('로그인 후 투표할 수 있어요');
      return;
    }

    const current = myVotes[commentId];
    // 점수 델타 미리 계산해서 낙관적 업데이트
    let scoreDelta = 0;
    let nextLocal: VoteValue | null = null;
    if (current === next) {
      // 같은 방향 → 취소
      scoreDelta = -current;
      nextLocal = null;
    } else if (current) {
      // 반대 방향 전환
      scoreDelta = next - current;
      nextLocal = next;
    } else {
      scoreDelta = next;
      nextLocal = next;
    }

    setComments(prev =>
      prev.map(c => (c.id === commentId ? { ...c, score: (c.score ?? 0) + scoreDelta } : c)),
    );
    setMyVotes(prev => {
      const copy = { ...prev };
      if (nextLocal === null) delete copy[commentId];
      else copy[commentId] = nextLocal;
      return copy;
    });

    try {
      if (current === next) {
        const { error } = await supabase
          .from('comment_votes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else if (current) {
        const { error } = await supabase
          .from('comment_votes')
          .update({ value: next })
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_votes')
          .insert({ comment_id: commentId, user_id: user.id, value: next });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('vote error:', err);
      toast.error('투표 실패 — 다시 시도해주세요');
      // 롤백
      setComments(prev =>
        prev.map(c => (c.id === commentId ? { ...c, score: (c.score ?? 0) - scoreDelta } : c)),
      );
      setMyVotes(prev => {
        const copy = { ...prev };
        if (current) copy[commentId] = current;
        else delete copy[commentId];
        return copy;
      });
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const avatarColor = (name: string) => {
    const colors = [
      'bg-violet-500', 'bg-indigo-500', 'bg-sky-500',
      'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-pink-500',
    ];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  };

  return (
    <section className="space-y-3 max-w-2xl mx-auto">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground tracking-tight">
          댓글 {comments.length > 0 && <span className="text-muted-foreground font-medium">({comments.length})</span>}
        </h2>
        <button
          onClick={fetchComments}
          disabled={isRefreshing}
          className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 입력 카드 */}
      <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
        {/* 닉네임 행 — 로그인 사용자는 프로필 표시명 고정 + Google 아바타 */}
        {user ? (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/20">
            {profile?.avatar_url || user.user_metadata?.avatar_url ? (
              <img
                src={profile?.avatar_url || user.user_metadata?.avatar_url}
                alt={username}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(username)}`}>
                {username[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="flex-1 text-sm font-medium text-foreground truncate">{username}</span>
            {profile?.is_protected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
        ) : showUsernameInput ? (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/30">
            <div className="w-7 h-7 rounded-full bg-muted border border-border/60 flex items-center justify-center flex-shrink-0">
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
              placeholder="닉네임을 설정해주세요 (또는 로그인)"
              className="flex-1 text-sm bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              maxLength={20}
            />
            <button
              onClick={handleSetUsername}
              disabled={!username.trim()}
              className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
            >
              설정
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/20">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(username)}`}>
              {username[0].toUpperCase()}
            </div>
            <span className="flex-1 text-sm font-medium text-foreground">{username}</span>
            <button
              onClick={() => setShowUsernameInput(true)}
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-0.5 rounded-full hover:bg-primary/10"
            >
              변경
            </button>
          </div>
        )}

        {/* 텍스트 입력 */}
        <div className="px-3 pt-2 pb-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            placeholder={showUsernameInput ? '닉네임을 먼저 설정해주세요' : '의견을 남겨주세요... (200자 이내)'}
            className="w-full text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none leading-snug"
            rows={1}
            maxLength={200}
            disabled={showUsernameInput || isLoading}
          />
        </div>

        {/* 하단 액션 바 */}
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="text-xs text-muted-foreground/60">
            {newComment.length > 0 ? `${newComment.length}/200` : ''}
          </span>
          <button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || showUsernameInput || isLoading}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <Send className="w-3 h-3" />
            <span>게시</span>
          </button>
        </div>
      </div>

      {/* 댓글 목록 */}
      <div className="space-y-3">
        {isRefreshing && comments.length === 0 ? (
          <div className="text-center py-10">
            <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-muted-foreground/60">불러오는 중...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm font-medium text-muted-foreground/60">아직 댓글이 없습니다</p>
            <p className="text-xs text-muted-foreground/40 mt-1">첫 번째 의견을 남겨보세요</p>
          </div>
        ) : (
          comments.map((comment) => {
            const score = comment.score ?? 0;
            const myVote = myVotes[comment.id];
            const scoreColor =
              score > 0 ? 'text-orange-600' : score < 0 ? 'text-blue-600' : 'text-muted-foreground/70';

            return (
              <div
                key={comment.id}
                className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-3 hover:bg-card/60 transition-colors"
              >
                <div className="flex items-stretch gap-3">
                  {/* 좌측 투표 컬럼 (Reddit 스타일) */}
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <button
                      onClick={() => handleVote(comment.id, 1)}
                      aria-label="추천"
                      className={`p-0.5 rounded transition-colors ${
                        myVote === 1
                          ? 'text-orange-600'
                          : 'text-muted-foreground/40 hover:text-orange-500 hover:bg-orange-50'
                      }`}
                    >
                      <ChevronUp className={`w-4 h-4 ${myVote === 1 ? 'stroke-[3]' : 'stroke-2'}`} />
                    </button>
                    <span className={`text-xs font-bold tabular-nums leading-none ${scoreColor}`}>
                      {score}
                    </span>
                    <button
                      onClick={() => handleVote(comment.id, -1)}
                      aria-label="비추천"
                      className={`p-0.5 rounded transition-colors ${
                        myVote === -1
                          ? 'text-blue-600'
                          : 'text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <ChevronDown className={`w-4 h-4 ${myVote === -1 ? 'stroke-[3]' : 'stroke-2'}`} />
                    </button>
                  </div>

                  {/* 본문 */}
                  <div className="flex-1 min-w-0 flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(comment.author)}`}>
                      {comment.author[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground truncate">{comment.author}</span>
                        <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">{formatTimestamp(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                        {comment.message}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
