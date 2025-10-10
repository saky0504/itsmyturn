import React, { useState, useRef, useEffect } from 'react';
import { motion, PanInfo, useAnimationControls } from 'framer-motion';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Shuffle, Repeat, Search, Music } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { useIsMobile } from './ui/use-mobile';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import referenceLP from 'figma:asset/da548d540d08adba07ff463391103da0bd49d5a7.png';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  preview_url: string;
  duration: number;
  spotify_url: string;
}

export function VinylPlayerBackup() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [volume, setVolume] = useState(75);
  const [showVolumeToast, setShowVolumeToast] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false); // ?�동?�생 ?�용 ?��?
  const spinControls = useAnimationControls();
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const shouldAutoPlayRef = useRef<boolean>(false);
  const isMobile = useIsMobile();
  const volumeToastTimeoutRef = useRef<NodeJS.Timeout>();

  const currentTrack = tracks[currentTrackIndex];

  // ?�� Spotify API ?�출 ?�수??
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
        setTracks(data.tracks.filter((track: Track) => track.preview_url));
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

  // Safe JSON parsing helper
  const safeJsonParse = async (response: Response): Promise<any> => {
    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new Error('Empty response from server');
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('JSON parse error:', error);
      console.error('Response text:', text.substring(0, 500));
      throw new Error('Invalid JSON response from server');
    }
  };

  // ?�버 ?�스 체크
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
      
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      toast.error('Server connection failed');
      return false;
    }
  };

  // Load tracks from Spotify API with retry
  useEffect(() => {
    // ?�스???�스???�스??
    setTimeout(() => {
      toast.success('VinylPlayer ?�작??, { 
        duration: 2000,
        description: '?�악???�생??준비�? ?�료?�었?�니??
      });
    }, 500);
    
    const initializeApp = async () => {
      try {
        setTracksLoading(true);
        const isHealthy = await checkServerHealth();
        if (isHealthy) {
          await loadRecommendations();
        } else {
          // If health check fails, show toast and retry after 3 seconds
          console.log('?�� ?�버 건강 ?�태 ?�인 ?�패');
          toast.error('?�버 ?�결 ?�패', {
            duration: 3000,
            description: '3�????�동?�로 ?�시?�합?�다'
          });
          setTimeout(() => {
            console.log('?�� ?�버 ?�연�??�도 �?..');
            initializeApp(); // Retry
          }, 3000);
        }
      } catch (error) {
        console.error('App initialization error:', error);
        toast.error('??초기???�패', {
          duration: 4000,
          description: '?�시 ???�시 ?�도?�주?�요'
        });
      } finally {
        setTracksLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  // Volume toast indicator (smooth tone)
  const showVolumeIndicator = (newVolume: number) => {
    toast(`?�� Volume ${newVolume}%`, {
      duration: 1500,
      position: 'top-center'
    });
  };

  // ?�디???�벤???�들??
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
        console.log('?�� Duration loaded:', audio.duration);
      }
    };
    
    const handleLoadStart = () => {
      console.log('?�� Loading audio...');
      setIsLoading(true);
    };
    
    const handleCanPlay = () => {
      console.log('?�� Audio can play');
      setIsLoading(false);
    };
    
    const handleLoadedData = () => {
      console.log('?�� Audio data loaded');
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    
    const handleEnded = () => {
      console.log('?�� Track ended');
      setIsPlaying(false);
      setCurrentTime(0);
      handleNextTrack();
    };
    
    const handleError = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      const error = audio.error;
      
      let errorMessage = 'Failed to load audio';
      let errorCode = 'UNKNOWN';
      
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorCode = 'MEDIA_ERR_ABORTED';
            errorMessage = 'Audio loading was aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorCode = 'MEDIA_ERR_NETWORK';
            errorMessage = 'Network error while loading audio';
            break;
          case error.MEDIA_ERR_DECODE:
            errorCode = 'MEDIA_ERR_DECODE';
            errorMessage = 'Audio decoding error';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorCode = 'MEDIA_ERR_SRC_NOT_SUPPORTED';
            errorMessage = 'Audio format not supported';
            break;
          default:
            errorMessage = error.message || 'Unknown audio error';
        }
      }
      
      console.error('??Audio error:', {
        code: errorCode,
        message: errorMessage,
        src: audio.src,
        currentSrc: audio.currentSrc,
        networkState: audio.networkState,
        readyState: audio.readyState
      });
      
      setIsLoading(false);
      setIsPlaying(false);
      
      // SRC_NOT_SUPPORTED ?�러??경우 ?�동?�로 ?�음 ?�생 가?�한 ?�랙?�로 ?�동
      if (error?.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        console.log('?�� Trying to find next playable track...');
        const nextIndex = findNextPlayableTrack(currentTrackIndex);
        if (nextIndex !== -1 && nextIndex !== currentTrackIndex) {
          toast('Switching to available track...', { duration: 2000 });
          setTimeout(() => {
            setCurrentTrackIndex(nextIndex);
          }, 500);
          return;
        }
      }
      
      // ?�른 ?�러??경우 ?�용?�에�??�림
      toast.error('Audio playback failed');
    };

    const handlePlay = () => {
      console.log('?�� Audio started playing');
      setIsPlaying(true);
      setIsLoading(false);
    };

    const handlePause = () => {
      console.log('?�� Audio paused');
      setIsPlaying(false);
    };

    // 모든 ?�벤??리스???�록
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [currentTrackIndex]);

  // 볼륨 ?�데?�트
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // ?�랙 변�????�동 ?�생 처리
  useEffect(() => {
    if (!currentTrack) return;

    const setupNewTrack = async () => {
      try {
        setIsLoading(true);
        setCurrentTime(0);
        setDuration(0);
        
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          
          // ???�랙 URL ?�정 (?�효??검???�함)
          if (isValidPreviewUrl(currentTrack.preview_url)) {
            console.log('??Setting valid preview URL:', currentTrack.preview_url);
            audioRef.current.src = currentTrack.preview_url!;
            audioRef.current.load(); // 강제�????�스 로드
          } else {
            console.log('?�️ Invalid preview URL, removing audio source:', currentTrack.preview_url);
            audioRef.current.removeAttribute('src');
            audioRef.current.load();
          }
        }
        
        console.log('?�� Setting up track:', currentTrack.title, currentTrack.preview_url);
        
        // ?�동 ?�생???�요??경우 (?�용?��? ?��? ?�호?�용?�고 ?�효??URL??경우�?
        if (shouldAutoPlayRef.current && audioRef.current && isValidPreviewUrl(currentTrack.preview_url) && hasUserInteracted) {
          shouldAutoPlayRef.current = false;
          
          // ?�디??로딩 ?��?
          const waitForLoad = new Promise<void>((resolve) => {
            if (!audioRef.current) return resolve();
            
            const handleCanPlay = () => {
              audioRef.current?.removeEventListener('canplay', handleCanPlay);
              resolve();
            };
            
            if (audioRef.current.readyState >= 2) {
              resolve();
            } else {
              audioRef.current.addEventListener('canplay', handleCanPlay);
            }
          });
          
          try {
            await waitForLoad;
            if (audioRef.current) {
              audioRef.current.volume = volume / 100;
              await audioRef.current.play();
              console.log('?�� Auto-playing:', currentTrack.title);
            }
          } catch (error) {
            console.error('??Auto-play error:', error);
            setIsPlaying(false);
            toast.error('?�동?�생??차단?�었?�니?? ?�생 버튼???�릭?�주?�요.');
          }
        }
      } catch (error) {
        console.error('??Track setup error:', error);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    };

    setupNewTrack();
  }, [currentTrack]);

  // ?�드?�어 볼륨 ??감�?
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        const newVolume = event.code === 'ArrowUp' 
          ? Math.min(100, volume + 10) 
          : Math.max(0, volume - 10);
        
        setVolume(newVolume);
        showVolumeIndicator(newVolume);
        if (audioRef.current) {
          audioRef.current.volume = newVolume / 100;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume]);

  // LP ?�전 ?�니메이???�어
  useEffect(() => {
    if (isPlaying) {
      spinControls.start({
        rotate: [0, 360],
        transition: {
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }
      });
    } else {
      spinControls.stop();
    }
  }, [isPlaying, spinControls, currentTrackIndex]);

  // Preview URL ?�효??검??(??관?�?�게)
  const isValidPreviewUrl = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol.startsWith('http');
    } catch {
      return false;
    }
  };

  // ?�생 가?�한 ?�음 ?�랙 찾기
  const findNextPlayableTrack = (startIndex: number, direction: 'next' | 'prev' = 'next'): number => {
    let index = startIndex;
    let attempts = 0;
    const maxAttempts = tracks.length;

    while (attempts < maxAttempts) {
      if (direction === 'next') {
        index = (index + 1) % tracks.length;
      } else {
        index = index === 0 ? tracks.length - 1 : index - 1;
      }

      if (isValidPreviewUrl(tracks[index]?.preview_url)) {
        return index;
      }
      
      attempts++;
    }
    
    return -1; // ?�생 가?�한 ?�랙???�음
  };

  const handlePlayPause = async () => {
    if (!audioRef.current) {
      console.log('??No audio element');
      return;
    }

    // Preview URL ?�효??검??
    if (!isValidPreviewUrl(currentTrack?.preview_url)) {
      console.log('??Invalid preview URL, trying to find next playable track');
      const nextPlayableIndex = findNextPlayableTrack(currentTrackIndex);
      
      if (nextPlayableIndex === -1) {
        toast.error('No playable tracks available');
        return;
      }
      
      setCurrentTrackIndex(nextPlayableIndex);
      toast('Switching to available track...', { duration: 2000 });
      return;
    }

    // �?번째 ?�용???�호?�용 기록
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        console.log('?�️ Paused');
      } else {
        console.log('?�️ Attempting to play:', currentTrack.title);
        setIsLoading(true);
        audioRef.current.volume = volume / 100;
        
        // 짧�? ?�?�아?�으�?로딩 ?�간 ?�한
        const playPromise = Promise.race([
          audioRef.current.play(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Load timeout')), 10000)
          )
        ]);
        
        await playPromise;
        console.log('??Playing started');
      }
    } catch (error: any) {
      console.error('??Play/pause error:', {
        name: error.name,
        message: error.message,
        code: error.code,
        trackTitle: currentTrack?.title,
        previewUrl: currentTrack?.preview_url
      });
      
      setIsLoading(false);
      setIsPlaying(false);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Click to allow audio playback');
      } else if (error.message === 'Load timeout') {
        toast.error('Track loading timeout');
        // ?�?�아?????�음 ?�랙?�로 ?�어가�?
        const nextIndex = findNextPlayableTrack(currentTrackIndex);
        if (nextIndex !== -1) {
          setCurrentTrackIndex(nextIndex);
        }
      } else if (error.name === 'AbortError') {
        toast.error('Audio playback was interrupted');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Audio format not supported');
        // 지?�되지 ?�는 ?�식??경우 ?�음 ?�생 가?�한 ?�랙?�로
        const nextIndex = findNextPlayableTrack(currentTrackIndex);
        if (nextIndex !== -1) {
          setCurrentTrackIndex(nextIndex);
        }
      } else {
        toast.error('Playback failed');
      }
    }
  };

  const handlePreviousTrack = () => {
    if (tracks.length === 0) return;
    
    const wasPlaying = isPlaying && hasUserInteracted;
    shouldAutoPlayRef.current = wasPlaying;
    setIsPlaying(false);
    
    // ?�생 가?�한 ?�전 ?�랙 찾기
    const nextIndex = findNextPlayableTrack(currentTrackIndex, 'prev');
    if (nextIndex !== -1) {
      setCurrentTrackIndex(nextIndex);
      console.log(`?�� Previous playable track ${wasPlaying ? '(auto-play)' : '(paused)'}`);
    } else {
      // ?�생 가?�한 ?�랙???�으�?기본 ?�작
      setCurrentTrackIndex((prev) => 
        prev === 0 ? tracks.length - 1 : prev - 1
      );
      console.log(`?�� Previous track ${wasPlaying ? '(auto-play)' : '(paused)'} - may not be playable`);
    }
  };

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    
    const wasPlaying = isPlaying && hasUserInteracted;
    shouldAutoPlayRef.current = wasPlaying;
    setIsPlaying(false);
    
    // ?�생 가?�한 ?�음 ?�랙 찾기
    const nextIndex = findNextPlayableTrack(currentTrackIndex, 'next');
    if (nextIndex !== -1) {
      setCurrentTrackIndex(nextIndex);
      console.log(`?�� Next playable track ${wasPlaying ? '(auto-play)' : '(paused)'}`);
    } else {
      // ?�생 가?�한 ?�랙???�으�?기본 ?�작
      setCurrentTrackIndex((prev) => 
        prev === tracks.length - 1 ? 0 : prev + 1
      );
      console.log(`?�� Next track ${wasPlaying ? '(auto-play)' : '(paused)'} - may not be playable`);
    }
  };

  const handleSeek = (newTime: number) => {
    if (!audioRef.current || !duration) return;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 진행�??�릭 ?�들??
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    handleSeek(newTime);
  };

  // 검???�들??
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await searchTracks(searchQuery.trim());
      setShowSearch(false);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Show loading state while tracks are being loaded
  if (tracksLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100">
        {/* ?�표가 ?�함??로딩 ?�디케?�터 */}
        <div className="relative w-20 h-20 mb-6">
          {/* ?��? ?�전?�는 �?*/}
          <div className="absolute inset-0 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
          
          {/* 중앙 ?�표 ?�이�?*/}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              className="text-gray-800 animate-pulse"
            >
              <path 
                d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" 
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

      </div>
    );
  }

  // Show error state if no tracks available - use toast instead of full screen
  if (!currentTrack && tracks.length === 0) {
    // Show error toast immediately
    React.useEffect(() => {
      // Multiple toast attempts to ensure visibility
      setTimeout(() => {
        toast.error('?�악??불러?????�습?�다', {
          duration: 6000,
          description: '?�트?�크 ?�결???�인?�주?�요',
          action: {
            label: '?�시 ?�도',
            onClick: () => {
              toast.info('?�로고침 중입?�다...', { duration: 1000 });
              setTimeout(() => window.location.reload(), 500);
            }
          }
        });
      }, 100);
      
      // Backup alert if toast doesn't work
      setTimeout(() => {
        console.log('?�� ?�악 로딩 ?�패 - ?�스???�림???�시?�어???�니??);
      }, 200);
    }, []);
    
    // Show placeholder track instead of empty state
    const placeholderTrack = {
      id: 'placeholder',
      title: '?�악 로딩 �?..',
      artist: '?�시�?기다?�주?�요',
      album: 'Loading',
      cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      preview_url: null,
      duration: 0,
      spotify_url: ''
    };
    
    // Use placeholder immediately
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100">
        <div className="w-80 h-80 rounded-full bg-gray-200 flex items-center justify-center mb-8">
          <Music className="w-20 h-20 text-gray-400" />
        </div>
        <p className="text-gray-600 text-center mb-4">?�악??불러?�는 중입?�다...</p>
        <Button 
          onClick={() => {
            toast.info('?�로고침 �?..', { duration: 1000 });
            setTimeout(() => window.location.reload(), 500);
          }}
          className="bg-gray-900 text-white hover:bg-gray-700"
        >
          ?�� ?�시 ?�도
        </Button>
      </div>
    );
  }

  const handleDragEnd = (event: any, info: PanInfo) => {
    // 모바?�에?�는 ??민감?�게, ?�스?�톱?�서????민감?�게
    const swipeThreshold = isMobile ? 30 : 50;
    
    if (info.offset.x > swipeThreshold) {
      // ?�른�??��??�프 - ?�음 ?�랙
      handleNextTrack();
    } else if (info.offset.x < -swipeThreshold) {
      // ?�쪽 ?��??�프 - ?�전 ?�랙
      handlePreviousTrack();
    }
  };

  return (
    <div className={`flex flex-col min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 ${isMobile ? 'pt-0' : 'p-8 justify-center items-center'}`}>
      {/* ?�모 모드 ?�시 */}
      {isDemoMode && (
        <div className="fixed top-4 left-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
          ?�모 모드 ?��
        </div>
      )}
      
      {/* 모바?�에?�는 LP가 ?�면 ?�단???�게 차�? */}
      {isMobile ? (
        <div className="relative w-full flex-1 flex flex-col">
          {/* LP ?�역 - ?�면 ?�단 60% 차�? */}
          <div className="relative h-[60vh] overflow-hidden flex items-center justify-center">
            {/* ?�테?�블 베이??- 모바?�에?�는 ?�면보다 ?�게 */}
            <div className="relative -mt-32" ref={containerRef}>
              <motion.div
                className="relative cursor-pointer w-[126vw] h-[126vw]"
                onClick={handlePlayPause}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* LP ?�코??베이??*/}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      radial-gradient(circle at 28% 18%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 25%, transparent 60%),
                      radial-gradient(circle at 72% 82%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 30%, transparent 50%),
                      radial-gradient(circle at center, #0f0f0f 0%, #080808 100%)
                    `,
                    boxShadow: `
                      inset 0 0 40px rgba(255,255,255,0.12),
                      inset 0 0 80px rgba(0,0,0,0.8),
                      inset 0 2px 4px rgba(255,255,255,0.08),
                      inset 0 -1px 3px rgba(0,0,0,0.6),
                      0 0 30px rgba(0,0,0,0.6),
                      0 8px 25px rgba(0,0,0,0.5)
                    `
                  }}
                />
                
                {/* LP ???�턴 ?�버?�이 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 1px,
                        rgba(0,0,0,0.4) 1.5px,
                        rgba(0,0,0,0.4) 2px,
                        transparent 2.5px,
                        transparent 4px
                      )
                    `,
                    opacity: 0.6
                  }}
                />
                
                {/* 추�? ???�턴 ?�이?�들 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 6px,
                        rgba(0,0,0,0.3) 6.5px,
                        rgba(0,0,0,0.3) 7px,
                        transparent 7.5px,
                        transparent 12px
                      )
                    `,
                    opacity: 0.5
                  }}
                />
                
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 12px,
                        rgba(0,0,0,0.25) 12.5px,
                        rgba(0,0,0,0.25) 13.5px,
                        transparent 14px,
                        transparent 20px
                      )
                    `,
                    opacity: 0.4
                  }}
                />
                
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 20px,
                        rgba(0,0,0,0.2) 20.5px,
                        rgba(0,0,0,0.2) 22px,
                        transparent 22.5px,
                        transparent 28px
                      )
                    `,
                    opacity: 0.3
                  }}
                />
                
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 28px,
                        rgba(0,0,0,0.15) 28.5px,
                        rgba(0,0,0,0.15) 30.5px,
                        transparent 31px,
                        transparent 36px
                      )
                    `,
                    opacity: 0.25
                  }}
                />
  
                {/* ?�범 커버 (가?�데) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    className="w-[42vw] h-[42vw] rounded-full overflow-hidden bg-gray-200 shadow-lg"
                    animate={spinControls}
                  >
                    <ImageWithFallback
                      src={currentTrack.cover}
                      alt={`${currentTrack.title} cover`}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                </div>
                
                {/* 중앙 ?�피???� */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    className="w-[3vw] h-[3vw] bg-gray-800 rounded-full shadow-inner"
                    style={{
                      boxShadow: 'inset 0 0 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)'
                    }}
                  />
                </div>
                
                {/* ?�생/?�시?��? ?�시 (?�치 ?�에�??�시) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {isLoading ? (
                    <div className="w-[16vw] h-[16vw] border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-[16vw] h-[16vw] bg-black bg-opacity-70 rounded-full flex items-center justify-center opacity-0 transition-opacity duration-200 group-active:opacity-100">
                      {isPlaying ? (
                        <Pause className="text-white w-[8vw] h-[8vw]" />
                      ) : (
                        <Play className="text-white ml-1 w-[8vw] h-[8vw]" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>


            </div>
          </div>
          
          {/* 컨텐�??�역 - ?�면 ?�단 40% */}
          <div className="flex-1 px-6 pb-6 flex flex-col justify-between">
            {/* ?�랙 ?�보 */}
            <div className="text-center mb-2 px-4">
              {/* ?�목 - ??줄로 ?�동 줄바�?*/}
              <h2 className="text-2xl text-gray-900 mb-2 leading-tight">
                {currentTrack.title}
              </h2>
              
              {/* ?�티?�트 */}
              <p className="text-gray-600 text-lg">{currentTrack.artist}</p>
            </div>

            {/* ?�생 진행 �?*/}
            <div className="w-full mb-2">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div 
                className="w-full bg-gray-300 rounded-full h-1 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const width = rect.width;
                  const newTime = (clickX / width) * duration;
                  handleSeek(newTime);
                }}
              >
                <div 
                  className="bg-gray-900 rounded-full h-1 transition-all duration-100"
                  style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* 컨트�??�널 - ?�전 균등??간격?�로 ?�렬 */}
            <div className="grid grid-cols-5 gap-4 items-center w-full max-w-sm mx-auto mb-2 px-4">
              {/* 1?? 검??버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSearch(true)}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* 2?? ?�전 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousTrack}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                disabled={tracks.length <= 1}
              >
                <SkipBack className="w-5 h-5" />
              </Button>

              {/* 3?? 메인 ?�생/?�시?��? 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePlayPause}
                className="text-gray-600 hover:text-gray-900 w-14 h-14 bg-gray-100 hover:bg-gray-200 justify-self-center"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7" />
                ) : (
                  <Play className="w-7 h-7 ml-0.5" />
                )}
              </Button>

              {/* 4?? ?�음 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextTrack}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                disabled={tracks.length <= 1}
              >
                <SkipForward className="w-5 h-5" />
              </Button>

              {/* 5?? 추천 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={loadRecommendations}
                disabled={isLoading}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
              >
                <Music className="w-5 h-5" />
              </Button>
            </div>

          </div>
        </div>
      ) : (
        /* ?�스?�톱 ?�이?�웃 */
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[104px] items-center">
            {/* LP ?�테?�블 */}
            <div className="relative flex items-center justify-center" ref={containerRef}>
              <motion.div
                className="relative cursor-pointer w-[504px] h-[504px] rounded-full"
                onClick={handlePlayPause}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* LP ?�코??베이??*/}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      radial-gradient(circle at 28% 18%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 25%, transparent 60%),
                      radial-gradient(circle at 72% 82%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 30%, transparent 50%),
                      radial-gradient(circle at center, #0f0f0f 0%, #080808 100%)
                    `,
                    boxShadow: `
                      inset 0 0 40px rgba(255,255,255,0.12),
                      inset 0 0 80px rgba(0,0,0,0.8),
                      inset 0 2px 4px rgba(255,255,255,0.08),
                      inset 0 -1px 3px rgba(0,0,0,0.6),
                      0 0 30px rgba(0,0,0,0.6),
                      0 8px 25px rgba(0,0,0,0.5)
                    `
                  }}
                />
                
                {/* LP ???�턴 ?�버?�이 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 1px,
                        rgba(0,0,0,0.4) 1.5px,
                        rgba(0,0,0,0.4) 2px,
                        transparent 2.5px,
                        transparent 4px
                      )
                    `,
                    opacity: 0.6
                  }}
                />
                
                {/* 추�? ???�턴 ?�이?�들 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 6px,
                        rgba(0,0,0,0.3) 6.5px,
                        rgba(0,0,0,0.3) 7px,
                        transparent 7.5px,
                        transparent 12px
                      )
                    `,
                    opacity: 0.5
                  }}
                />
                
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 12px,
                        rgba(0,0,0,0.25) 12.5px,
                        rgba(0,0,0,0.25) 13.5px,
                        transparent 14px,
                        transparent 20px
                      )
                    `,
                    opacity: 0.4
                  }}
                />
                
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 20px,
                        rgba(0,0,0,0.2) 20.5px,
                        rgba(0,0,0,0.2) 22px,
                        transparent 22.5px,
                        transparent 28px
                      )
                    `,
                    opacity: 0.3
                  }}
                />
                
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 28px,
                        rgba(0,0,0,0.15) 28.5px,
                        rgba(0,0,0,0.15) 30.5px,
                        transparent 31px,
                        transparent 36px
                      )
                    `,
                    opacity: 0.25
                  }}
                />

                {/* ?�범 커버 (가?�데) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    className="w-48 h-48 rounded-full overflow-hidden bg-gray-200 shadow-lg"
                    animate={spinControls}
                  >
                    <ImageWithFallback
                      src={currentTrack.cover}
                      alt={`${currentTrack.title} cover`}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                </div>
                
                {/* 중앙 ?�피???� */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    className="w-3 h-3 bg-gray-800 rounded-full shadow-inner"
                    style={{
                      boxShadow: 'inset 0 0 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)'
                    }}
                  />
                </div>
                
                {/* ?�생/?�시?��? ?�시 (?�치 ?�에�??�시) */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  {isLoading ? (
                    <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-20 h-20 bg-black bg-opacity-70 rounded-full flex items-center justify-center">
                      {isPlaying ? (
                        <Pause className="text-white w-8 h-8" />
                      ) : (
                        <Play className="text-white ml-1 w-8 h-8" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* ?�이??컨트�??�널 */}
            <div className="space-y-8">
              {/* ?�랙 ?�보 */}
              <div className="text-center lg:text-left">
                <h2 className="text-4xl text-gray-900 mb-4 leading-tight">
                  {currentTrack.title}
                </h2>
                <p className="text-gray-600 text-xl mb-2">{currentTrack.artist}</p>
                <p className="text-gray-500">{currentTrack.album}</p>
              </div>

              {/* ?�생 진행 �?*/}
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div 
                  className="w-full bg-gray-300 rounded-full h-1 cursor-pointer"
                  onClick={handleProgressClick}
                >
                  <div 
                    className="bg-gray-900 rounded-full h-1 transition-all duration-100"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              {/* 컨트�?버튼??*/}
              <div className="flex items-center justify-center lg:justify-start space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSearch(true)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Search className="w-5 h-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePreviousTrack}
                  className="text-gray-600 hover:text-gray-900"
                  disabled={tracks.length <= 1}
                >
                  <SkipBack className="w-6 h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayPause}
                  className="text-gray-600 hover:text-gray-900 w-16 h-16 bg-gray-100 hover:bg-gray-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8 ml-0.5" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextTrack}
                  className="text-gray-600 hover:text-gray-900"
                  disabled={tracks.length <= 1}
                >
                  <SkipForward className="w-6 h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadRecommendations}
                  disabled={isLoading}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Music className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ?�디???�리먼트 */}
      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
      />

      {/* 검???�업 */}
      {showSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white border-0 shadow-2xl">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <h3 className="text-xl text-gray-900 mb-2">?�악 검??/h3>
                <p className="text-gray-600 text-sm">?�티?�트??�??�목???�력?�세??/p>
              </div>
              
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="relative">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="?�티?�트??�??�목..."
                    className="w-full pl-4 pr-4 py-3 text-base border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-gray-900 focus:ring-0 transition-colors"
                    autoFocus
                    disabled={isSearching}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowSearch(false)}
                    className="flex-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={!searchQuery.trim() || isSearching}
                    className="flex-1 bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-300"
                  >
                    {isSearching ? '검??�?..' : '검??}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
