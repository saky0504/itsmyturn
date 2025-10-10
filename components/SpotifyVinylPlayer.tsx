import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Search, Music } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  preview_url: string;
  duration: number;
  spotify_url: string;
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

export default function SpotifyVinylPlayer() {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [showVolumeToast, setShowVolumeToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const spinControls = useAnimationControls();
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumeToastTimeoutRef = useRef<NodeJS.Timeout>();
  const isMobile = useIsMobile();

  const currentTrack = tracks[currentTrackIndex] || {
    id: '1',
    title: 'Search for music',
    artist: 'Use the search button to find tracks',
    album: 'Spotify',
    cover: '',
    preview_url: '',
    duration: 0,
    spotify_url: ''
  };

  // API 호출 함수들
  const searchTracks = async (query: string) => {
    try {
      setIsSearching(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f3afc2d2/spotify/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to search tracks');
      }
      
      const data = await response.json();
      if (data.tracks && data.tracks.length > 0) {
        setTracks(data.tracks.filter((track: SpotifyTrack) => track.preview_url));
        setCurrentTrackIndex(0);
        toast.success(`Found ${data.tracks.length} tracks`);
      } else {
        toast.error('No tracks found with preview');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search tracks');
    } finally {
      setIsSearching(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      console.log('Loading recommendations from Spotify...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f3afc2d2/spotify/recommendations`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      console.log('Recommendations response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Recommendations API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Recommendations data:', {
        hasTracksArray: !!data.tracks,
        tracksCount: data.tracks?.length || 0
      });
      
      if (data.tracks && data.tracks.length > 0) {
        setTracks(data.tracks);
        setCurrentTrackIndex(0);
        toast.success(`Loaded ${data.tracks.length} tracks`);
      } else {
        toast.error('No tracks found with preview available');
      }
    } catch (error) {
      console.error('Recommendations error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error(`Failed to load recommendations: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // LP 회전 애니메이션 관리
  useEffect(() => {
    if (isPlaying) {
      spinControls.start({
        rotate: 360,
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "linear"
        }
      });
    } else {
      spinControls.stop();
    }
  }, [isPlaying, spinControls]);

  // 오디오 이벤트 핸들러
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      nextTrack();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex]);

  // 볼륨 키보드 컨트롤
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        const newVolume = e.code === 'ArrowUp' 
          ? Math.min(1, volume + 0.1) 
          : Math.max(0, volume - 0.1);
        
        setVolume(newVolume);
        if (audioRef.current) {
          audioRef.current.volume = newVolume;
        }
        
        setShowVolumeToast(true);
        if (volumeToastTimeoutRef.current) {
          clearTimeout(volumeToastTimeoutRef.current);
        }
        volumeToastTimeoutRef.current = setTimeout(() => {
          setShowVolumeToast(false);
        }, 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume]);

  // 재생/일시정지
  const togglePlayPause = async () => {
    if (!audioRef.current || !currentTrack.preview_url) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        audioRef.current.volume = volume;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Play error:', error);
      toast.error('Failed to play track');
    } finally {
      setIsLoading(false);
    }
  };

  // 다음 트랙
  const nextTrack = () => {
    if (tracks.length > 0) {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
      setIsPlaying(false);
    }
  };

  // 이전 트랙
  const prevTrack = () => {
    if (tracks.length > 0) {
      setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
      setIsPlaying(false);
    }
  };

  // 진행바 클릭
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 스와이프 제스처
  const handlePanEnd = (event: any, info: any) => {
    const threshold = 50;
    if (info.offset.x > threshold) {
      prevTrack();
    } else if (info.offset.x < -threshold) {
      nextTrack();
    }
  };

  // 검색 핸들러
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await searchTracks(searchQuery.trim());
      setShowSearch(false);
    }
  };

  // 서버 헬스 체크
  const checkServerHealth = async () => {
    try {
      console.log('Checking server health...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f3afc2d2/spotify/health`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const data = await response.json();
      console.log('Server health check:', data);
      
      if (!data.hasCredentials) {
        toast.error('Spotify credentials not configured on server');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      toast.error('Server connection failed');
      return false;
    }
  };

  // 컴포넌트 마운트 시 헬스 체크 후 추천 트랙 로드
  useEffect(() => {
    const initializeApp = async () => {
      const isHealthy = await checkServerHealth();
      if (isHealthy) {
        await loadRecommendations();
      }
    };
    
    initializeApp();
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-yellow-50 to-amber-100 p-4">
        {/* 볼륨 토스트 */}
        {showVolumeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <Volume2 size={16} />
              <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-200"
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
              <span className="text-sm">{Math.round(volume * 100)}%</span>
            </div>
          </motion.div>
        )}

        {/* 검색 인터페이스 */}
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4"
            onClick={() => setShowSearch(false)}
          >
            <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
              <CardContent className="p-6">
                <form onSubmit={handleSearch} className="space-y-4">
                  <h3 className="text-xl text-center">Search Spotify</h3>
                  <Input
                    type="text"
                    placeholder="Search for songs, artists, albums..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSearching} className="flex-1">
                      {isSearching ? 'Searching...' : 'Search'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowSearch(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* LP 레코드 */}
        <motion.div
          className="relative w-80 h-80 mb-8 cursor-pointer"
          onClick={togglePlayPause}
          whileTap={{ scale: 0.95 }}
          animate={spinControls}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onPanEnd={handlePanEnd}
          dragElastic={0.3}
        >
          {/* 외부 LP */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-900 to-black shadow-2xl">
            {/* 홈 패턴 */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-gray-700/30"
                style={{
                  top: `${8 + i * 6}%`,
                  left: `${8 + i * 6}%`,
                  right: `${8 + i * 6}%`,
                  bottom: `${8 + i * 6}%`,
                }}
              />
            ))}
            
            {/* 중앙 앨범 커버 */}
            <div className="absolute top-1/2 left-1/2 w-32 h-32 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden border-4 border-gray-800 shadow-lg">
              {currentTrack.cover ? (
                <ImageWithFallback
                  src={currentTrack.cover}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center">
                  <Music size={32} className="text-gray-600" />
                </div>
              )}
            </div>
            
            {/* 중앙 구멍 */}
            <div className="absolute top-1/2 left-1/2 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-600 shadow-inner" />
            
            {/* 재생/일시정지 표시 */}
            {isLoading ? (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/70 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/70 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                {isPlaying ? (
                  <Pause size={24} className="text-white ml-1" />
                ) : (
                  <Play size={24} className="text-white ml-1" />
                )}
              </motion.div>
            )}
          </div>

          {/* 톤암 */}
          <motion.div
            className="absolute -top-4 -right-8 w-32 h-2 origin-left"
            animate={{
              rotate: isPlaying ? 25 : 0
            }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            <div className="w-full h-full bg-gradient-to-r from-gray-300 to-gray-100 rounded-full shadow-lg" />
            <div className="absolute right-0 top-1/2 w-3 h-3 -translate-y-1/2 bg-gray-600 rounded-full shadow-sm" />
          </motion.div>
        </motion.div>

        {/* 트랙 정보 */}
        <div className="text-center mb-6 px-4">
          <h2 className="text-2xl text-gray-900 mb-3 leading-tight">
            {currentTrack.title}
          </h2>
          <p className="text-gray-600 text-lg">{currentTrack.artist}</p>
        </div>

        {/* 진행바 */}
        {currentTrack.preview_url && (
          <div className="w-full max-w-sm mb-6">
            <div
              className="w-full h-2 bg-gray-200 rounded-full cursor-pointer overflow-hidden"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-amber-500 transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500 mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={prevTrack}
            disabled={tracks.length === 0}
            className="w-12 h-12 rounded-full"
          >
            <SkipBack size={20} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={nextTrack}
            disabled={tracks.length === 0}
            className="w-12 h-12 rounded-full"
          >
            <SkipForward size={20} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSearch(true)}
            className="w-12 h-12 rounded-full"
          >
            <Search size={20} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={loadRecommendations}
            disabled={isLoading}
            className="w-12 h-12 rounded-full"
          >
            <Music size={20} />
          </Button>
        </div>

        {/* 사용 안내 */}
        <div className="text-center text-gray-500 text-sm mt-8 px-4">
          <p>LP를 터치해서 재생/일시정지</p>
          <p>좌우로 드래그해서 트랙 변경</p>
          <p>볼륨: ↑↓ 키 사용</p>
          <p className="text-xs mt-2 text-amber-600">30초 미리보기만 재생됩니다</p>
        </div>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={currentTrack.preview_url}
          onLoadStart={() => setIsLoading(true)}
          onCanPlayThrough={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            toast.error('Failed to load audio');
          }}
        />
      </div>
    );
  }

  // 데스크톱 버전은 기존과 동일한 구조...
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-100 p-8">
      {/* 볼륨 토스트 */}
      {showVolumeToast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <Volume2 size={20} />
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all duration-200"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">{Math.round(volume * 100)}%</span>
          </div>
        </motion.div>
      )}

      {/* 검색 인터페이스 */}
      {showSearch && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4"
          onClick={() => setShowSearch(false)}
        >
          <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <CardContent className="p-8">
              <form onSubmit={handleSearch} className="space-y-6">
                <h3 className="text-2xl text-center">Search Spotify</h3>
                <Input
                  type="text"
                  placeholder="Search for songs, artists, albums..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="text-lg"
                />
                <div className="flex gap-4">
                  <Button type="submit" disabled={isSearching} className="flex-1">
                    {isSearching ? 'Searching...' : 'Search'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowSearch(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div ref={containerRef} className="text-center">
        {/* LP 턴테이블 */}
        <motion.div
          className="relative w-96 h-96 mb-12 cursor-pointer mx-auto"
          onClick={togglePlayPause}
          whileTap={{ scale: 0.98 }}
          animate={spinControls}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onPanEnd={handlePanEnd}
          dragElastic={0.2}
        >
          {/* 외부 LP */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-900 to-black shadow-2xl">
            {/* 홈 패턴 */}
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-gray-700/30"
                style={{
                  top: `${6 + i * 5.5}%`,
                  left: `${6 + i * 5.5}%`,
                  right: `${6 + i * 5.5}%`,
                  bottom: `${6 + i * 5.5}%`,
                }}
              />
            ))}
            
            {/* 중앙 앨범 커버 */}
            <div className="absolute top-1/2 left-1/2 w-40 h-40 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden border-4 border-gray-800 shadow-lg">
              {currentTrack.cover ? (
                <ImageWithFallback
                  src={currentTrack.cover}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center">
                  <Music size={48} className="text-gray-600" />
                </div>
              )}
            </div>
            
            {/* 중앙 구멍 */}
            <div className="absolute top-1/2 left-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 shadow-inner" />
            
            {/* 재생/일시정지 표시 */}
            {isLoading ? (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-black/70 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-black/70 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                {isPlaying ? (
                  <Pause size={32} className="text-white ml-1" />
                ) : (
                  <Play size={32} className="text-white ml-1" />
                )}
              </motion.div>
            )}
          </div>

          {/* 톤암 */}
          <motion.div
            className="absolute -top-6 -right-12 w-40 h-3 origin-left"
            animate={{
              rotate: isPlaying ? 30 : 0
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <div className="w-full h-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-100 rounded-full shadow-xl border border-gray-400" />
            <div className="absolute right-0 top-1/2 w-4 h-4 -translate-y-1/2 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full shadow-lg" />
          </motion.div>
        </motion.div>

        {/* 트랙 정보 */}
        <div className="text-center mb-8 max-w-md px-4">
          <h2 className="text-gray-900 text-2xl mb-2 leading-tight">
            {currentTrack.title}
          </h2>
          <p className="text-gray-600 text-lg">{currentTrack.artist}</p>
        </div>

        {/* 진행바 */}
        {currentTrack.preview_url && (
          <div className="w-full max-w-md mb-8 mx-auto">
            <div
              className="w-full h-3 bg-gray-200 rounded-full cursor-pointer overflow-hidden shadow-inner"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-100 shadow-sm"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500 mt-3">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex items-center justify-center gap-8">
          <Button
            variant="outline"
            size="icon"
            onClick={prevTrack}
            disabled={tracks.length === 0}
            className="w-16 h-16 rounded-full border-2 hover:bg-amber-50"
          >
            <SkipBack size={24} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={nextTrack}
            disabled={tracks.length === 0}
            className="w-16 h-16 rounded-full border-2 hover:bg-amber-50"
          >
            <SkipForward size={24} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSearch(true)}
            className="w-16 h-16 rounded-full border-2 hover:bg-amber-50"
          >
            <Search size={24} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={loadRecommendations}
            disabled={isLoading}
            className="w-16 h-16 rounded-full border-2 hover:bg-amber-50"
          >
            <Music size={24} />
          </Button>
        </div>

        {/* 사용 안내 */}
        <div className="text-center text-gray-500 mt-12 max-w-lg">
          <p className="mb-2">LP를 클릭해서 재생/일시정지 • 좌우로 드래그해서 트랙 변경</p>
          <p className="mb-2">진행바를 클릭해서 구간 이동 • 볼륨: ↑↓ 키 사용</p>
          <p className="text-sm text-amber-600 mt-4">⚠️ Spotify 30초 미리보기만 재생됩니다</p>
        </div>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={currentTrack.preview_url}
          onLoadStart={() => setIsLoading(true)}
          onCanPlayThrough={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            toast.error('Failed to load audio');
          }}
        />
      </div>
    </div>
  );
}