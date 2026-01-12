import { useState, useEffect } from 'react';
import { Send, Heart, User, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
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

  // Load username from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setUsername(savedUsername);
      setShowUsernameInput(false);
    }
  }, []);

  // Fetch comments for this product
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
        // 에러가 발생해도 조용히 처리 (RLS 정책, 테이블 없음 등은 정상적인 상황일 수 있음)
        // 빈 배열로 설정하고 에러 메시지는 표시하지 않음
        setComments([]);
        return;
      }

      // data가 null이거나 undefined가 아닌 경우 (빈 배열도 정상)
      if (data !== null && data !== undefined) {
        setComments(data as Comment[]);
      } else {
        // data가 null인 경우 빈 배열로 설정
        setComments([]);
      }
    } catch (error: unknown) {
      console.error('Error:', error);
      // 모든 에러를 조용히 처리 (빈 배열로 설정)
      setComments([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load comments on mount
  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Subscribe to real-time updates for this product
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

      // Update local state
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

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">댓글</h2>
        <p className="text-xs font-normal text-muted-foreground mt-1">
          이 앨범에 대한 의견을 남겨주세요
        </p>
      </div>

      {/* Username Setup */}
      {showUsernameInput && (
        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
              placeholder="닉네임을 설정해주세요"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              maxLength={20}
            />
            <Button
              onClick={handleSetUsername}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-12 text-xs p-0"
            >
              설정
            </Button>
          </div>
        </div>
      )}

      {/* Current User Info */}
      {!showUsernameInput && (
        <div className="px-4 py-2 bg-muted rounded-lg border border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{username}</span>
          </div>
          <button
            onClick={() => setShowUsernameInput(true)}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            변경
          </button>
        </div>
      )}

      {/* Comment Input */}
      <div className="space-y-2">
        <div className="flex gap-2 items-stretch">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            placeholder="의견을 남겨주세요... (200자 이내)"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg resize-none bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            maxLength={200}
            disabled={showUsernameInput || isLoading}
          />
          <Button
            onClick={handleSubmitComment}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-12 p-0"
            disabled={!newComment.trim() || showUsernameInput || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {newComment.length > 0 && (
          <p className="text-xs font-normal text-muted-foreground text-right">
            {newComment.length}/200
          </p>
        )}
      </div>

      {/* Refresh Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-normal text-muted-foreground">
          댓글 {comments.length}개
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchComments}
          disabled={isRefreshing}
          className="h-8"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {isRefreshing && comments.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-spin" />
            <p className="text-sm font-normal text-muted-foreground">댓글을 불러오는 중...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-normal text-muted-foreground">아직 댓글이 없습니다</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-muted rounded-lg p-4 border border-border"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                    {comment.author[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{comment.author}</p>
                    <p className="text-xs font-normal text-muted-foreground">{formatTimestamp(comment.created_at)}</p>
                  </div>
                </div>
              </div>

              <p className="text-sm font-normal text-foreground whitespace-pre-wrap break-words mb-2">
                {comment.message}
              </p>

              <button
                onClick={() => handleLike(comment.id)}
                className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-primary transition-colors"
              >
                <Heart className={`w-4 h-4 ${comment.likes > 0 ? 'fill-primary text-primary' : ''}`} />
                <span>{comment.likes > 0 ? comment.likes : '좋아요'}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

