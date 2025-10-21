import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageCircle, Heart, User, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { supabase, type Comment } from '../src/lib/supabase';
import { toast } from 'sonner';

interface CommunityBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommunityBoard({ isOpen, onClose }: CommunityBoardProps) {
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

  // Fetch comments from Supabase
  const fetchComments = async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching comments:', error);
        toast.error('Failed to load comments');
        return;
      }

      if (data) {
        setComments(data);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load comments when board opens
  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isOpen) return;

    // Set up real-time subscription
    const channel = supabase
      .channel('comments-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setComments(prev => [payload.new as Comment, ...prev]);
            toast.success('New comment added');
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
  }, [isOpen]);

  const handleSetUsername = () => {
    if (username.trim()) {
      localStorage.setItem('username', username.trim());
      setShowUsernameInput(false);
      toast.success(`Welcome, ${username.trim()}!`);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            author: username || 'Anonymous',
            message: newComment.trim(),
            track_id: null,
            track_title: null,
            track_artist: null,
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error posting comment:', error);
        toast.error('Failed to post comment');
        return;
      }

      if (data) {
        // Real-time subscription will handle adding to the list
        setNewComment('');
        toast.success('Comment posted successfully');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to post comment');
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
        toast.error('Failed to like comment');
        return;
      }

      // Update local state
      setComments(comments.map(c => 
        c.id === commentId ? { ...c, likes: c.likes + 1 } : c
      ));
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to like comment');
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Board Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">Community Board</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchComments}
                  disabled={isRefreshing}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Username Setup */}
            {showUsernameInput && (
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <p className="text-sm text-gray-700 mb-2">Welcome! Please set your nickname</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
                    placeholder="Enter nickname"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={20}
                  />
                  <Button
                    onClick={handleSetUsername}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Set
                  </Button>
                </div>
              </div>
            )}

            {/* Current User Info */}
            {!showUsernameInput && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{username}</span>
                </div>
                <button
                  onClick={() => setShowUsernameInput(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Change
                </button>
              </div>
            )}

            {/* Comment Input */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                  placeholder="Share your thoughts... (30 chars max)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  maxLength={30}
                  disabled={showUsernameInput || isLoading}
                />
                <Button
                  onClick={handleSubmitComment}
                  size="sm"
                  className="h-auto bg-blue-600 hover:bg-blue-700"
                  disabled={!newComment.trim() || showUsernameInput || isLoading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {newComment.length > 0 && (
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {newComment.length}/30
                </p>
              )}
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isRefreshing && comments.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
                  <p className="text-sm text-gray-500">Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No comments yet</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                            {comment.author[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{comment.author}</p>
                            <p className="text-xs text-gray-500">{formatTimestamp(comment.created_at)}</p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mb-2">
                        {comment.message}
                      </p>
                      
                      <button
                        onClick={() => handleLike(comment.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <Heart className={`w-4 h-4 ${comment.likes > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                        <span>{comment.likes > 0 ? comment.likes : 'Like'}</span>
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
