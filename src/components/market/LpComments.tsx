import { useState, useEffect } from 'react';
import { Send, Heart, RefreshCw, Pencil } from 'lucide-react';
import { supabase, type Comment } from '../../lib/supabase';
import { toast } from 'sonner';

interface LpCommentsProps {
  productId: string;
  productTitle: string;
  productArtist: string;
}

export function LpComments({ productId, productTitle, productArtist }: LpCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [username, setUsername] = useState('');
  const [showUsernameInput, setShowUsernameInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setUsername(savedUsername);
      setShowUsernameInput(false);
    }
  }, []);

  const fetchComments = async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('track_id', productId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching comments:', error);
        setComments([]);
        return;
      }

      if (data !== null && data !== undefined) {
        setComments(data as Comment[]);
      } else {
        setComments([]);
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
  }, [productId]);

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

  const handleLike = async (commentId: string) => {
    try {
      const { error } = await supabase.rpc('increment_comment_likes', {
        comment_id: commentId
      });

      if (error) {
        console.error('Error liking comment:', error);
        toast.error('좋아요에 실패했습니다');
        return;
      }

      setComments(comments.map(c =>
        c.id === commentId ? { ...c, likes: c.likes + 1 } : c
      ));
    } catch (error) {
      console.error('Error:', error);
      toast.error('좋아요에 실패했습니다');
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
    <section className="space-y-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">댓글</h2>
          <p className="text-xs text-muted-foreground mt-0.5">이 앨범에 대한 의견을 남겨주세요</p>
        </div>
        <button
          onClick={fetchComments}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all duration-200 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{comments.length > 0 ? `${comments.length}개` : '새로고침'}</span>
        </button>
      </div>

      {/* 입력 카드 */}
      <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
        {/* 닉네임 행 */}
        {showUsernameInput ? (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
            <div className="w-7 h-7 rounded-full bg-muted border border-border/60 flex items-center justify-center flex-shrink-0">
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
              placeholder="닉네임을 설정해주세요"
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
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
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
        <div className="px-4 pt-3 pb-2">
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
            className="w-full text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none leading-relaxed"
            rows={3}
            maxLength={200}
            disabled={showUsernameInput || isLoading}
          />
        </div>

        {/* 하단 액션 바 */}
        <div className="flex items-center justify-between px-4 pb-3">
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
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 hover:bg-card/60 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 ${avatarColor(comment.author)}`}>
                  {comment.author[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground truncate">{comment.author}</span>
                    <span className="text-xs text-muted-foreground/60 flex-shrink-0">{formatTimestamp(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {comment.message}
                  </p>
                  <button
                    onClick={() => handleLike(comment.id)}
                    className={`mt-2 flex items-center gap-1 text-xs transition-colors ${comment.likes > 0 ? 'text-rose-500' : 'text-muted-foreground/50 hover:text-rose-400'}`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${comment.likes > 0 ? 'fill-rose-500' : ''}`} />
                    <span>{comment.likes > 0 ? comment.likes : '좋아요'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
