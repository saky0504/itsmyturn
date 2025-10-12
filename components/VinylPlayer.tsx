import React, { useState, useRef, useEffect } from 'react';
import { motion, PanInfo, useAnimationControls } from 'framer-motion';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Play, Pause, SkipBack, SkipForward, Search, Music, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { useIsMobile } from './ui/use-mobile';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  preview_url: string;
  duration: number;
  spotify_url: string;
  lyrics?: string;
  genre?: string;
  spotify_id?: string;
}

export function VinylPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [isDemoMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false); // 자동재생 사용 여부
  const [showLyrics, setShowLyrics] = useState(false);
  const spinControls = useAnimationControls();
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const shouldAutoPlayRef = useRef<boolean>(false);
  const isMobile = useIsMobile();

  const currentTrack = tracks[currentTrackIndex];

  // 커버 이미지 미리 로딩
  useEffect(() => {
    if (tracks.length > 0) {
      // 현재 트랙과 다음 트랙의 커버 이미지를 미리 로드
      const imagesToPreload = [];
      
      if (currentTrack?.cover) {
        imagesToPreload.push(currentTrack.cover);
      }
      
      const nextIndex = (currentTrackIndex + 1) % tracks.length;
      if (tracks[nextIndex]?.cover) {
        imagesToPreload.push(tracks[nextIndex].cover);
      }
      
      imagesToPreload.forEach(imageUrl => {
        const img = new Image();
        img.src = imageUrl;
        console.log('🖼️ Preloading cover image:', imageUrl);
      });
    }
  }, [tracks, currentTrackIndex, currentTrack?.cover]);

  // 음악 Spotify API 호출 함수
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
        console.log(`Found ${data.tracks.length} tracks`);
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

  // Internet Archive Search API로 실제 음원 검색
  const searchInternetArchive = async (query: string, rows: number = 50) => {
    try {
      console.log(`🔍 Searching Internet Archive: ${query}`);
      
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=avg_rating&rows=${rows}&sort[]=downloads+desc&output=json`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Found ${data.response.docs.length} items from Internet Archive`);
      
      return data.response.docs;
    } catch (error) {
      console.error('❌ Internet Archive search failed:', error);
      throw error;
    }
  };

  // Internet Archive Metadata API로 실제 스트리밍 URL 추출
  const getStreamingUrl = async (identifier: string) => {
    try {
      console.log(`🎵 Getting metadata for: ${identifier}`);
      
      const metadataUrl = `https://archive.org/metadata/${identifier}`;
      const response = await fetch(metadataUrl);
      
      if (!response.ok) {
        throw new Error(`Metadata fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // MP3 파일 찾기 (우선순위: .mp3 > .ogg > .wav)
      const mp3Files = data.files.filter((file: any) => 
        file.name.endsWith('.mp3') && 
        file.format !== 'Metadata' && 
        !file.name.includes('_files.xml')
      );
      
      if (mp3Files.length === 0) {
        throw new Error('No MP3 files found');
      }
      
      // 첫 번째 MP3 파일 선택 (보통 가장 큰 파일이 메인 트랙)
      const audioFile = mp3Files[0];
      const streamingUrl = `https://archive.org/download/${identifier}/${audioFile.name}`;
      
      console.log(`✅ Streaming URL found: ${audioFile.name}`);
      
      return {
        streamingUrl,
        duration: audioFile.length ? parseInt(audioFile.length) * 1000 : 180000, // length in seconds
        fileSize: audioFile.size
      };
    } catch (error) {
      console.error(`❌ Failed to get streaming URL for ${identifier}:`, error);
      throw error;
    }
  };

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      console.log('🎵 Loading tracks from Internet Archive Search API...');
      
      // Internet Archive에서 인기 음원 검색
      const searchQueries = [
        '(collection:78rpm OR collection:netlabels) AND mediatype:audio',
        'collection:78rpm AND mediatype:audio',
        'collection:netlabels AND mediatype:audio',
        'mediatype:audio AND (jazz OR classical OR blues OR folk)'
      ];
      
      let allItems: any[] = [];
      
      // 여러 검색어로 충분한 결과 확보
      for (const query of searchQueries) {
        try {
          const items = await searchInternetArchive(query, 25);
          allItems = allItems.concat(items);
        } catch (error) {
          console.warn(`Search query failed: ${query}`, error);
        }
      }
      
      // 중복 제거 및 랜덤 선택
      const uniqueItems = allItems.filter((item, index, self) => 
        index === self.findIndex(t => t.identifier === item.identifier)
      );
      
      console.log(`📚 Total unique items found: ${uniqueItems.length}`);
      
      // 랜덤하게 5개 선택
      const shuffledItems = [...uniqueItems].sort(() => Math.random() - 0.5);
      const selectedItems = shuffledItems.slice(0, 5);
      
      const archiveTracks: Track[] = [];
      
      // 각 선택된 항목의 스트리밍 URL 추출 (순차적으로)
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        try {
          console.log(`🔄 Loading track ${i + 1}/${selectedItems.length}: ${item.title || item.identifier}`);
          
          const { streamingUrl, duration } = await getStreamingUrl(item.identifier);
          
          const track: Track = {
            id: item.identifier,
            title: item.title || 'Unknown Title',
            artist: item.creator || 'Unknown Artist',
            album: item.identifier,
            cover: `https://images.unsplash.com/photo-${1507838153414 + i}?w=600&h=600&fit=crop`, // 랜덤 커버
            preview_url: streamingUrl,
            duration: duration,
            spotify_url: `https://open.spotify.com/search/${encodeURIComponent(item.title || '')}`,
            lyrics: `From Internet Archive\nClassic audio recording\nPublic domain music`,
            genre: 'Classical'
          };
          
          archiveTracks.push(track);
          console.log(`✅ Track ${i + 1} ready: ${track.title} - ${track.artist}`);
          
          // 첫 번째 트랙이 로드되면 UI에 반영 (자동재생 없음)
          if (i === 0) {
            setTracks([track]);
            setCurrentTrackIndex(0);
            console.log('🎵 First track loaded - Click Play to start');
            toast.success(`Track 1 loaded! Click Play to start`, {
              duration: 3000
            });
          }
          
          // 각 트랙 로딩 간격 (너무 빠르면 서버 부하)
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.warn(`❌ Failed to process item ${item.identifier}:`, error);
          // 실패한 항목은 건너뛰고 계속 진행
        }
      }
      
      if (archiveTracks.length === 0) {
        throw new Error('No playable tracks found');
      }
      
      console.log('✅ Final selected tracks:', archiveTracks.map(t => `${t.title} - ${t.artist}`));
      
      // 나머지 트랙들을 플레이리스트에 추가
      if (archiveTracks.length > 1) {
        setTracks(prevTracks => {
          const remainingTracks = archiveTracks.slice(1); // 첫 번째는 이미 추가됨
          const newTracks = remainingTracks.filter((newTrack: Track) => 
            !prevTracks.some(existingTrack => existingTrack.id === newTrack.id)
          );
          return [...prevTracks, ...newTracks];
        });
        
        console.log(`✅ Added ${archiveTracks.length - 1} more tracks to playlist`);
      }
      
      console.log(`✅ Total ${archiveTracks.length} Internet Archive tracks in playlist`);
      
    } catch (error) {
      console.error('❌ Failed to load tracks:', error);
      toast.error(`Failed to load tracks: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };


  // 서버 상태 체크
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
    // Toast system test
    setTimeout(() => {
      console.log('VinylPlayer Started - Ready to play music');
    }, 500);

    // 사용자 상호작용 감지 (수동 재생을 위해)
    const enableUserInteraction = () => {
      setHasUserInteracted(true);
      console.log('🎵 User interaction detected');
    };

    // 사용자 상호작용 감지 이벤트
    document.addEventListener('click', enableUserInteraction, { once: true });
    document.addEventListener('keydown', enableUserInteraction, { once: true });
    document.addEventListener('touchstart', enableUserInteraction, { once: true });
    
    const initializeApp = async () => {
      try {
        setTracksLoading(true);
        console.log('🎵 Initializing music player...');
        
        // Internet Archive 음원은 서버 체크 불필요
        // 바로 음원 로드
        await loadRecommendations();
        
        console.log('✅ Music player initialized successfully!');
      } catch (error) {
        console.error('❌ App initialization error:', error);
        toast.error('Failed to load music tracks', {
          duration: 4000,
          description: 'Please refresh the page'
        });
      } finally {
        setTracksLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  // Volume toast indicator (smooth tone)
  const showVolumeIndicator = (newVolume: number) => {
    toast(`🔊 Volume ${newVolume}%`, {
      duration: 1500,
      position: 'top-center'
    });
  };

  // 오디오 이벤트 핸들러들
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
        console.log('Duration loaded:', audio.duration);
      }
    };
    
    const handleLoadStart = () => {
      console.log('Loading audio...');
      setIsLoading(true);
    };
    
    const handleCanPlay = () => {
      console.log('Audio can play');
      setIsLoading(false);
    };
    
    const handleLoadedData = () => {
      console.log('Audio data loaded');
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    
    const handleEnded = () => {
      console.log('Track ended');
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
      
      console.error('❌ Audio error:', {
        code: errorCode,
        message: errorMessage,
        src: audio.src,
        currentSrc: audio.currentSrc,
        networkState: audio.networkState,
        readyState: audio.readyState
      });
      
      setIsLoading(false);
      setIsPlaying(false);
      
      // SRC_NOT_SUPPORTED 에러인 경우 자동으로 다음 재생 가능한 트랙으로 이동
      if (error && error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        console.log('🔄 Trying to find next playable track...');
        const nextIndex = findNextPlayableTrack(currentTrackIndex);
        if (nextIndex !== -1 && nextIndex !== currentTrackIndex) {
          toast('Switching to available track...', { duration: 2000 });
          setTimeout(() => {
            setCurrentTrackIndex(nextIndex);
          }, 500);
          return;
        }
      }
      
      // 다른 에러인 경우 사용자에게 알림
      toast.error('Audio playback failed');
    };

    const handlePlay = () => {
      console.log('🎵 Audio started playing');
      setIsPlaying(true);
      setIsLoading(false);
    };

    const handlePause = () => {
      console.log('🎵 Audio paused');
      setIsPlaying(false);
    };

    // 모든 이벤트 리스너 등록
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

  // 볼륨 업데이트 - 안전한 처리
  useEffect(() => {
    if (audioRef.current && !isNaN(volume)) {
      try {
        audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
      } catch (error) {
        console.warn('Volume update failed:', error);
      }
    }
  }, [volume]);

  // 트랙 변경 시 자동 재생 처리
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
          
          // 새 트랙 URL 설정 (유효성 검증 포함)
          if (isValidPreviewUrl(currentTrack.preview_url)) {
            console.log('✅ Setting valid preview URL:', currentTrack.preview_url);
            audioRef.current.src = currentTrack.preview_url!;
            audioRef.current.load(); // 강제로 오디오 로드
          } else {
            console.log('⚠️ Invalid preview URL, removing audio source:', currentTrack.preview_url);
            audioRef.current.removeAttribute('src');
            audioRef.current.load();
          }
        }
        
        console.log('🎵 Setting up track:', currentTrack.title, currentTrack.preview_url);
        
        // 자동 재생이 필요한 경우 (사용자가 재생 요청했고 유효한 URL인 경우)
        if (shouldAutoPlayRef.current && audioRef.current && isValidPreviewUrl(currentTrack.preview_url) && hasUserInteracted) {
          shouldAutoPlayRef.current = false;
          
          // 오디오 로딩 대기
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
              try {
                audioRef.current.volume = Math.max(0, Math.min(1, (volume || 75) / 100));
                await audioRef.current.play();
                console.log('🎵 Auto-playing:', currentTrack.title);
              } catch (playError) {
                console.warn('Audio play failed:', playError);
                throw playError;
              }
            }
          } catch (error) {
            console.error('❌ Auto-play error:', error);
            setIsPlaying(false);
            toast.error('Auto-play blocked. Please click the play button.');
          }
        }
      } catch (error) {
        console.error('❌ Track setup error:', error);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    };

    setupNewTrack();
  }, [currentTrack]);

  // 키보드 볼륨 조절 - 안전한 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 입력 필드가 활성화되지 않았을 때만 볼륨 조절
      if ((event.code === 'ArrowUp' || event.code === 'ArrowDown') &&
          !(event.target instanceof HTMLInputElement) &&
          !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        
        try {
          const currentVolume = Math.max(0, Math.min(100, volume || 75));
          const newVolume = event.code === 'ArrowUp' 
            ? Math.min(100, currentVolume + 10) 
            : Math.max(0, currentVolume - 10);
          
          setVolume(newVolume);
          showVolumeIndicator(newVolume);
          
          if (audioRef.current && !isNaN(newVolume)) {
            audioRef.current.volume = newVolume / 100;
          }
        } catch (error) {
          console.warn('Volume control error:', error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume]);

  // LP 회전 애니메이션 컨트롤러
  useEffect(() => {
    if (isPlaying && !isLoading) {
      console.log('🎵 Starting LP rotation animation');
      spinControls.start({
        rotate: [0, 360],
        transition: {
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }
      });
    } else {
      console.log('⏸️ Stopping LP rotation animation');
      spinControls.stop();
    }
  }, [isPlaying, isLoading, spinControls, currentTrackIndex]);

  // 재생 진행률 업데이트 - 부드러운 진행 표시
  useEffect(() => {
    let animationFrameId: number;
    
    const updateProgress = () => {
      if (audioRef.current && isPlaying) {
        setCurrentTime(audioRef.current.currentTime);
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };
    
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying]);

  // Preview URL 유효성 검증 (Spotify + 데모 URL 지원)
  const isValidPreviewUrl = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol.startsWith('http') && 
             (urlObj.hostname.includes('scdn.co') || 
              urlObj.hostname.includes('spotify.com') ||
              urlObj.hostname.includes('archive.org') ||
              urlObj.hostname.includes('freesound.org') ||
              urlObj.hostname.includes('uic.edu') ||
              urlObj.hostname.includes('cs.uic.edu'));
    } catch {
      return false;
    }
  };

  // 재생 가능한 다음 트랙 찾기
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
    
    return -1; // 재생 가능한 트랙 없음
  };

  const handlePlayPause = async () => {
    if (!audioRef.current) {
      console.log('❌ No audio element');
      return;
    }

    // 트랙이 없는 경우
    if (!currentTrack || tracks.length === 0) {
      console.log('❌ No tracks available');
      toast.error('No tracks available. Please load some tracks first.');
      return;
    }

    // Preview URL 유효성 검증
    if (!isValidPreviewUrl(currentTrack?.preview_url)) {
      console.log('❌ Invalid preview URL:', currentTrack?.preview_url);
      console.log('🎵 Current track details:', {
        title: currentTrack?.title,
        artist: currentTrack?.artist,
        preview_url: currentTrack?.preview_url
      });
      console.log('🔄 Trying to find next playable track...');
      const nextPlayableIndex = findNextPlayableTrack(currentTrackIndex);
      
      if (nextPlayableIndex === -1) {
        toast.error('No playable tracks available');
        return;
      }
      
      setCurrentTrackIndex(nextPlayableIndex);
      toast('Switching to available track...', { duration: 2000 });
      return;
    }

    // 첫 번째 사용자 상호작용 기록
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        console.log('⏸️ Paused');
      } else {
        // 재생하려고 하는데 트랙이 없는 경우
        if (!currentTrack) {
          toast.error('No tracks available. Please load some tracks first.');
          return;
        }
        console.log('▶️ Attempting to play:', currentTrack.title);
        setIsLoading(true);
        audioRef.current.volume = volume / 100;
        
        // 짧은 타임아웃으로 로딩 시간 제한
        const playPromise = Promise.race([
          audioRef.current.play(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Load timeout')), 10000)
          )
        ]);
        
        await playPromise;
        console.log('🎵 Playing started');
      }
    } catch (error: any) {
      console.error('❌ Play/pause error:', {
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
        // 타임아웃 시 다음 재생 트랙으로 넘어가기
        const nextIndex = findNextPlayableTrack(currentTrackIndex);
        if (nextIndex !== -1) {
          setCurrentTrackIndex(nextIndex);
        }
      } else if (error.name === 'AbortError') {
        // AbortError는 사용자가 의도적으로 중단한 경우이므로 토스트를 표시하지 않음
        console.log('Audio playback was interrupted (normal behavior)');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Audio format not supported');
        // 지원되지 않는 형식인 경우 다음 재생 가능한 트랙으로
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
    
    // 재생 가능한 이전 트랙 찾기
    const nextIndex = findNextPlayableTrack(currentTrackIndex, 'prev');
    if (nextIndex !== -1) {
      setCurrentTrackIndex(nextIndex);
      console.log(`🔄 Previous playable track ${wasPlaying ? '(auto-play)' : '(paused)'}`);
    } else {
      // 재생 가능한 트랙이 없으면 기본 동작
      setCurrentTrackIndex((prev) => 
        prev === 0 ? tracks.length - 1 : prev - 1
      );
      console.log(`🔄 Previous track ${wasPlaying ? '(auto-play)' : '(paused)'} - may not be playable`);
    }
  };

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    
    const wasPlaying = isPlaying && hasUserInteracted;
    shouldAutoPlayRef.current = wasPlaying;
    setIsPlaying(false);
    
    // 재생 가능한 다음 트랙 찾기
    const nextIndex = findNextPlayableTrack(currentTrackIndex, 'next');
    if (nextIndex !== -1) {
      setCurrentTrackIndex(nextIndex);
      console.log(`🔄 Next playable track ${wasPlaying ? '(auto-play)' : '(paused)'}`);
    } else {
      // 재생 가능한 트랙이 없으면 기본 동작
      setCurrentTrackIndex((prev) => 
        prev === tracks.length - 1 ? 0 : prev + 1
      );
      console.log(`🔄 Next track ${wasPlaying ? '(auto-play)' : '(paused)'} - may not be playable`);
    }
  };

  const handleSeek = (newTime: number) => {
    if (!audioRef.current || !duration) return;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };


  // 검색 핸들러
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
        {/* 음악이 포함된 로딩 인디케이터 */}
        <div className="relative w-20 h-20 mb-6">
          {/* 음표 아이콘 */}
          <div className="absolute inset-0 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
          
          {/* 중앙 음표 아이콘 */}
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
        toast.error('Failed to load music', {
          duration: 6000,
          description: 'Please check your network connection',
          action: {
            label: 'Retry',
            onClick: () => {
              toast.info('새로고침 중...', { duration: 1000 });
              setTimeout(() => window.location.reload(), 500);
            }
          }
        });
      }, 100);
      
      // Backup alert if toast doesn't work
      setTimeout(() => {
        console.log('❌ Music loading failed - Toast notification should be displayed');
      }, 200);
    }, []);
    
    
    // Use placeholder immediately
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100">
        <div className="w-80 h-80 rounded-full bg-gray-200 flex items-center justify-center mb-8">
          <Music className="w-20 h-20 text-gray-400" />
        </div>
        <p className="text-gray-600 text-center mb-4">음악을 불러오는 중입니다...</p>
        <Button 
          onClick={() => {
            toast.info('새로고침 중...', { duration: 1000 });
            setTimeout(() => window.location.reload(), 500);
          }}
          className="bg-gray-900 text-white hover:bg-gray-700"
        >
          다시 시도
        </Button>
      </div>
    );
  }

  const handleDragEnd = (_event: any, info: PanInfo) => {
    // 모바일에서는 더 민감하게, 데스크톱에서는 덜 민감하게
    const swipeThreshold = isMobile ? 30 : 50;
    
    if (info.offset.x > swipeThreshold) {
      // 오른쪽 스와이프 - 다음 트랙
      handleNextTrack();
    } else if (info.offset.x < -swipeThreshold) {
      // 왼쪽 스와이프 - 이전 트랙
      handlePreviousTrack();
    }
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-gradient-to-b from-gray-50 via-white to-gray-100 ${isMobile ? 'pt-0' : 'p-8 justify-center items-center'}`}>
      {/* Demo mode indicator */}
      {isDemoMode && (
        <div className="fixed top-4 left-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
          Demo Mode 활성
        </div>
      )}
      
      {/* 모바일에서는 LP가 화면 상단 60% 차지 */}
      {isMobile ? (
        <div className="relative w-full flex-1 flex flex-col">
          {/* LP 영역 - 화면 상단 60% 차지 */}
          <div className="relative h-[60vh] overflow-hidden flex items-center justify-center">
            {/* 턴테이블 베이스 - 모바일에서는 화면보다 크게 */}
            <div className="relative -mt-32" ref={containerRef}>
              <motion.div
                className="relative cursor-pointer w-[126vw] h-[126vw]"
                onClick={handlePlayPause}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                dragElastic={0.1}
                onTouchStart={(e) => {
                  // 브라우저 기본 스크롤 방지 (passive: false로 설정됨)
                  if (isMobile) {
                    e.preventDefault();
                  }
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* LP 디스크 베이스 */}
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
                
                {/* LP 그루브 패턴 오버레이 */}
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
                        transparent 8px
                      )
                    `,
                    opacity: 0.7
                  }}
                />
                
                {/* 미세 그루브 패턴 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 0.5px,
                        rgba(0,0,0,0.2) 0.7px,
                        rgba(0,0,0,0.2) 0.9px,
                        transparent 1px,
                        transparent 3px
                      )
                    `,
                    opacity: 0.4
                  }}
                />
                
                {/* 바이닐 중심 영역 */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  animate={spinControls}
                  style={{
                    width: '35%',
                    height: '35%',
                    background: `
                      radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08) 0%, transparent 40%),
                      radial-gradient(circle at center, #0a0a0a 0%, #000000 70%, #0a0a0a 100%)
                    `,
                    boxShadow: `
                      inset 0 0 20px rgba(0,0,0,0.8),
                      inset 0 1px 2px rgba(255,255,255,0.1),
                      0 0 8px rgba(0,0,0,0.4)
                    `
                  }}
                />
                
                {/* 무지개 반사 효과 */}
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  animate={spinControls}
                  style={{
                    background: `
                      conic-gradient(from 0deg,
                        transparent 0deg,
                        rgba(255,0,150,0.03) 60deg,
                        rgba(0,255,255,0.02) 120deg,
                        transparent 180deg,
                        rgba(255,255,0,0.02) 240deg,
                        rgba(150,0,255,0.03) 300deg,
                        transparent 360deg
                      )
                    `,
                    opacity: 0.6
                  }}
                />
                
                {/* LP 광택 효과 - 프리미엄 반사 */}
                <motion.div
                  className="absolute inset-0 rounded-full opacity-30"
                  animate={spinControls}
                  style={{
                    background: `
                      conic-gradient(from 0deg, 
                        transparent 0deg, 
                        rgba(255,255,255,0.08) 10deg,
                        rgba(255,255,255,0.18) 20deg, 
                        rgba(255,255,255,0.45) 30deg, 
                        rgba(255,255,255,0.35) 40deg,
                        rgba(255,255,255,0.15) 50deg, 
                        rgba(255,255,255,0.05) 60deg,
                        transparent 75deg,
                        transparent 105deg,
                        rgba(255,255,255,0.04) 120deg,
                        rgba(255,255,255,0.12) 140deg,
                        rgba(255,255,255,0.08) 160deg,
                        transparent 180deg,
                        transparent 190deg,
                        rgba(255,255,255,0.06) 210deg,
                        rgba(255,255,255,0.15) 230deg,
                        rgba(255,255,255,0.28) 245deg,
                        rgba(255,255,255,0.22) 260deg,
                        rgba(255,255,255,0.12) 275deg,
                        rgba(255,255,255,0.04) 290deg,
                        transparent 305deg,
                        transparent 360deg)
                    `
                  }}
                />
                
                {/* 추가 화면 스타일 */}
                <motion.div
                  className="absolute inset-0 rounded-full opacity-10"
                  animate={spinControls}
                  style={{
                    background: `
                      radial-gradient(ellipse 120% 80% at 40% 30%, 
                        rgba(255,255,255,0.1) 0%, 
                        transparent 60%),
                      radial-gradient(ellipse 80% 120% at 70% 70%, 
                        rgba(255,255,255,0.05) 0%, 
                        transparent 50%),
                      conic-gradient(from 45deg,
                        transparent 0deg,
                        rgba(255,255,255,0.02) 90deg,
                        transparent 180deg,
                        rgba(255,255,255,0.02) 270deg,
                        transparent 360deg)
                    `
                  }}
                />

                {/* LP 중앙 홀 */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full z-30 w-[4vw] h-[4vw] min-w-[16px] min-h-[16px]"
                  style={{
                    background: `
                      radial-gradient(circle at center,
                        #000000 0%,
                        #1a1a1a 25%,
                        #2a2a2a 50%,
                        #1a1a1a 75%,
                        #000000 100%)
                    `,
                    boxShadow: `
                      inset 0 0 8px rgba(0,0,0,0.95),
                      inset 0 2px 4px rgba(0,0,0,0.9),
                      inset 0 -1px 2px rgba(255,255,255,0.05),
                      0 0 2px rgba(255,255,255,0.1),
                      0 0 0 1px rgba(40,40,40,0.6)
                    `
                  }}
                />

                {/* 앨범 커버 */}
                <motion.div 
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden z-20 w-[40vw] h-[40vw]"
                  animate={spinControls}
                  style={{
                    boxShadow: `
                      0 0 0 1px rgba(0,0,0,0.8),
                      0 0 0 2px rgba(30,30,30,0.6),
                      0 0 0 3px rgba(50,50,50,0.3),
                      0 4px 15px rgba(0,0,0,0.6),
                      inset 0 0 10px rgba(0,0,0,0.3),
                      inset 0 2px 4px rgba(255,255,255,0.1)
                    `
                  }}
                >
                  {currentTrack?.cover ? (
                    <ImageWithFallback
                      key={`mobile-cover-${currentTrack.id}`}
                      src={currentTrack.cover}
                      alt={`${currentTrack.album} cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src="/images/duck-fallback.svg" 
                      alt="Music Loading" 
                      className="w-full h-full object-contain animate-pulse"
                    />
                  )}
                </motion.div>

                {/* 재생/일시정지 오버레이 */}
                <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center z-10 opacity-0 hover:opacity-60 transition-opacity duration-300">
                  {isLoading ? (
                    <div className="relative w-[12vw] h-[12vw] min-w-[48px] min-h-[48px]">
                      <div className="absolute inset-0 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white animate-pulse">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor"/>
                        </svg>
                      </div>
                    </div>
                  ) : isPlaying ? (
                    <Pause className="text-white w-[8vw] h-[8vw]" />
                  ) : (
                    <Play className="text-white ml-1 w-[8vw] h-[8vw]" />
                  )}
                </div>
              </motion.div>


            </div>
          </div>
          
          {/* 컨텐츠 영역 - 화면 하단 40% */}
          <div className="flex-1 px-6 pb-6 flex flex-col justify-between">
            {/* 트랙 정보 */}
            <div className="text-center mb-2 px-4">
              {/* 제목 - 한 줄로 자동 줄바꿈*/}
              <h2 className="text-gray-900 mb-1 leading-tight" style={{ fontSize: '1.75rem' }}>
                {currentTrack?.title || 'No Track Selected'}
              </h2>
              
              {/* 아티스트 */}
              <p className="text-gray-600 leading-tight" style={{ fontSize: '1.125rem' }}>
                {currentTrack?.artist || 'Load tracks to start playing'}
              </p>
            </div>

            {/* 재생 진행률 */}
            <div className="w-full mb-2">
              <div className="flex justify-between text-gray-600 mb-2" style={{ fontSize: '0.75rem' }}>
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

            {/* 컨트롤 패널 - 화면 균등 간격으로 배렬 */}
            <div className="grid grid-cols-5 gap-4 items-center w-full max-w-sm mx-auto mb-2 px-4">
              {/* 1번 검색버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSearch(true)}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* 2번 이전 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousTrack}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                disabled={tracks.length <= 1}
              >
                <SkipBack className="w-5 h-5" />
              </Button>

              {/* 3번 메인 재생/일시정지 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePlayPause}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>

              {/* 4번 다음 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextTrack}
                className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                disabled={tracks.length <= 1}
              >
                <SkipForward className="w-5 h-5" />
              </Button>

              {/* 5번 추천 버튼 */}
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
        /* 데스크톱 레이아웃 */
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[104px] items-center">
            {/* LP 턴테이블 */}
            <div className="relative flex items-center justify-center p-8" ref={containerRef}>
              <motion.div
                className="relative cursor-pointer w-[504px] h-[504px] rounded-full"
                onClick={handlePlayPause}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ aspectRatio: '1/1' }}
              >
                {/* LP 디스크 베이스 - 데스크톱 */}
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
                      inset 0 0 50px rgba(255,255,255,0.12),
                      inset 0 0 100px rgba(0,0,0,0.8),
                      inset 0 3px 6px rgba(255,255,255,0.08),
                      inset 0 -2px 4px rgba(0,0,0,0.6),
                      0 0 40px rgba(0,0,0,0.6),
                      0 12px 30px rgba(0,0,0,0.5)
                    `
                  }}
                />
                
                {/* LP 그루브 패턴 오버레이 - 데스크톱 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 1.2px,
                        rgba(0,0,0,0.4) 1.8px,
                        rgba(0,0,0,0.4) 2.4px,
                        transparent 3px,
                        transparent 9px
                      )
                    `,
                    opacity: 0.7
                  }}
                />
                
                {/* 미세 그루브 패턴 - 데스크톱 */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={spinControls}
                  style={{
                    background: `
                      repeating-radial-gradient(circle at center,
                        transparent 0px,
                        transparent 0.6px,
                        rgba(0,0,0,0.2) 0.8px,
                        rgba(0,0,0,0.2) 1px,
                        transparent 1.2px,
                        transparent 3.5px
                      )
                    `,
                    opacity: 0.4
                  }}
                />
                
                {/* 바이닐 중심 영역 - 데스크톱 */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  animate={spinControls}
                  style={{
                    width: '35%',
                    height: '35%',
                    background: `
                      radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08) 0%, transparent 40%),
                      radial-gradient(circle at center, #0a0a0a 0%, #000000 70%, #0a0a0a 100%)
                    `,
                    boxShadow: `
                      inset 0 0 25px rgba(0,0,0,0.8),
                      inset 0 1px 3px rgba(255,255,255,0.1),
                      0 0 10px rgba(0,0,0,0.4)
                    `
                  }}
                />
                
                {/* 무지개 반사 효과 - 데스크톱 */}
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  animate={spinControls}
                  style={{
                    background: `
                      conic-gradient(from 0deg,
                        transparent 0deg,
                        rgba(255,0,150,0.03) 60deg,
                        rgba(0,255,255,0.02) 120deg,
                        transparent 180deg,
                        rgba(255,255,0,0.02) 240deg,
                        rgba(150,0,255,0.03) 300deg,
                        transparent 360deg
                      )
                    `,
                    opacity: 0.6
                  }}
                />

                {/* LP 광택 효과 - 데스크톱 */}
                <motion.div
                  className="absolute inset-0 rounded-full opacity-30"
                  animate={spinControls}
                  style={{
                    background: `
                      conic-gradient(from 0deg, 
                        transparent 0deg, 
                        rgba(255,255,255,0.08) 10deg,
                        rgba(255,255,255,0.18) 20deg, 
                        rgba(255,255,255,0.45) 30deg, 
                        rgba(255,255,255,0.35) 40deg,
                        rgba(255,255,255,0.15) 50deg, 
                        rgba(255,255,255,0.05) 60deg,
                        transparent 75deg,
                        transparent 105deg,
                        rgba(255,255,255,0.04) 120deg,
                        rgba(255,255,255,0.12) 140deg,
                        rgba(255,255,255,0.08) 160deg,
                        transparent 180deg,
                        transparent 190deg,
                        rgba(255,255,255,0.06) 210deg,
                        rgba(255,255,255,0.15) 230deg,
                        rgba(255,255,255,0.28) 245deg,
                        rgba(255,255,255,0.22) 260deg,
                        rgba(255,255,255,0.12) 275deg,
                        rgba(255,255,255,0.04) 290deg,
                        transparent 305deg,
                        transparent 360deg)
                    `
                  }}
                />

                {/* LP 중앙 홀 - 데스크톱 */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full z-30 w-8 h-8"
                  style={{
                    background: `
                      radial-gradient(circle at center,
                        #000000 0%,
                        #1a1a1a 25%,
                        #2a2a2a 50%,
                        #1a1a1a 75%,
                        #000000 100%)
                    `,
                    boxShadow: `
                      inset 0 0 12px rgba(0,0,0,0.95),
                      inset 0 3px 6px rgba(0,0,0,0.9),
                      inset 0 -2px 4px rgba(255,255,255,0.05),
                      0 0 3px rgba(255,255,255,0.1),
                      0 0 0 1px rgba(40,40,40,0.6)
                    `
                  }}
                />

                {/* 앨범 커버 - 데스크톱 */}
                <motion.div 
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden z-20 w-52 h-52"
                  animate={spinControls}
                  style={{
                    boxShadow: `
                      0 0 0 2px rgba(0,0,0,0.8),
                      0 0 0 4px rgba(30,30,30,0.6),
                      0 0 0 6px rgba(50,50,50,0.3),
                      0 8px 25px rgba(0,0,0,0.6),
                      inset 0 0 20px rgba(0,0,0,0.3),
                      inset 0 3px 6px rgba(255,255,255,0.1)
                    `
                  }}
                >
                  {currentTrack?.cover ? (
                    <ImageWithFallback
                      key={`desktop-cover-${currentTrack.id}`}
                      src={currentTrack.cover}
                      alt={`${currentTrack.album} cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src="/images/duck-fallback.svg" 
                      alt="Music Loading" 
                      className="w-full h-full object-contain animate-pulse"
                    />
                  )}
                </motion.div>

                {/* 재생/일시정지 오버레이 */}
                <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center z-10 opacity-0 hover:opacity-60 transition-opacity duration-300">
                  {isLoading ? (
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white animate-pulse">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor"/>
                        </svg>
                      </div>
                    </div>
                  ) : isPlaying ? (
                    <Pause className="text-white w-16 h-16" />
                  ) : (
                    <Play className="text-white ml-2 w-16 h-16" />
                  )}
                </div>
              </motion.div>


            </div>

            {/* 컨트롤 패널 */}
            <div className="space-y-8">
              {/* 트랙 정보 */}
              <div className="text-center lg:text-left">
                <h2 className="text-gray-900 mb-1 leading-tight" style={{ fontSize: '2rem' }}>
                  {currentTrack?.title || 'No Track Selected'}
                </h2>
                <p className="text-gray-600 mb-0.5 leading-tight" style={{ fontSize: '1.25rem' }}>
                  {currentTrack?.artist || 'Load tracks to start playing'}
                </p>
                <p className="text-gray-500 leading-tight" style={{ fontSize: '1rem' }}>
                  {currentTrack?.album || 'Click the music button to load Spotify playlist'}
                </p>
              </div>

              {/* 재생 진행률 */}
              <div className="w-full">
                <div className="flex justify-between text-gray-600 mb-2" style={{ fontSize: '0.8125rem' }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div 
                  className="w-full bg-gray-300 rounded-full h-2 cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const width = rect.width;
                    const newTime = (clickX / width) * duration;
                    handleSeek(newTime);
                  }}
                >
                  <div 
                    className="bg-gray-900 rounded-full h-2 transition-all duration-100"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              {/* 플레이어 컨트롤 - 균등한 간격으로 배렬 */}
              <div className="flex items-center space-x-3 max-w-md mx-auto lg:mx-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSearch(true)}
                  className="text-gray-600 hover:text-gray-900 w-12 h-12"
                >
                  <Search className="w-6 h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePreviousTrack}
                  className="text-gray-600 hover:text-gray-900 w-12 h-12"
                  disabled={tracks.length <= 1}
                >
                  <SkipBack className="w-6 h-6" />
                </Button>

                {/* 메인 재생/일시정지 버튼 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayPause}
                  className="text-gray-600 hover:text-gray-900 w-12 h-12"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextTrack}
                  className="text-gray-600 hover:text-gray-900 w-12 h-12"
                  disabled={tracks.length <= 1}
                >
                  <SkipForward className="w-6 h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadRecommendations}
                  disabled={isLoading}
                  className="text-gray-600 hover:text-gray-900 w-12 h-12"
                >
                  <Music className="w-6 h-6" />
                </Button>

                {/* 가사 표시 버튼 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={`w-12 h-12 ${showLyrics ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}
                  disabled={!currentTrack || !currentTrack.lyrics}
                >
                  <FileText className="w-6 h-6" />
                </Button>
              </div>


            </div>
          </div>
        </div>
      )}

      {/* 검색 인터페이스 */}
      {showSearch && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4"
          onClick={() => setShowSearch(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col items-center space-y-6"
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="flex flex-col items-center space-y-6">
              <div className="relative">
                <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 text-gray-300 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search music..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="bg-transparent border-0 border-b-2 border-gray-300 text-white placeholder-gray-300 text-xl text-center pl-8 pr-2 py-3 w-80 focus:outline-none focus:border-white transition-colors"
                />
              </div>
              
              {searchQuery.trim() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  type="submit"
                  disabled={isSearching}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-3 rounded-full hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Searching...</span>
                    </div>
                  ) : (
                    'Search'
                  )}
                </motion.button>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* 가사 및 곡정보 모달 */}
      {showLyrics && currentTrack && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowLyrics(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Track Info</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLyrics(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>

            {/* Album cover and basic info */}
            <div className="flex items-start space-x-6 mb-6">
              <img
                src={currentTrack.cover}
                alt={currentTrack.album}
                className="w-32 h-32 rounded-xl object-cover shadow-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';
                }}
              />
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{currentTrack.title}</h3>
                <p className="text-lg text-gray-600 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{currentTrack.artist}</p>
                <p className="text-gray-500 mb-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{currentTrack.album}</p>
                {currentTrack.genre && (
                  <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {currentTrack.genre}
                  </span>
                )}
              </div>
            </div>

            {/* Lyrics */}
            {currentTrack.lyrics ? (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Lyrics</h4>
                <div className="bg-gray-50 rounded-xl p-6">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {currentTrack.lyrics}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Lyrics</h4>
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  <p className="text-gray-500" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Lyrics not available</p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Hidden audio element */}
      <audio
        key={currentTrack.id}
        ref={audioRef}
        src={isValidPreviewUrl(currentTrack.preview_url) ? currentTrack.preview_url! : undefined}
        preload="metadata"
        crossOrigin="anonymous"
        onError={(e) => {
          const audio = e.currentTarget;
          if (audio.error) {
            console.error('Audio loading failed:', {
              code: audio.error.code,
              message: audio.error.message,
              src: audio.src
            });
            // 오디오 로딩 실패 시 다음 트랙으로 자동 이동
            const nextIndex = findNextPlayableTrack(currentTrackIndex);
            if (nextIndex !== -1 && nextIndex !== currentTrackIndex) {
              setTimeout(() => {
                setCurrentTrackIndex(nextIndex);
              }, 1000);
            }
          }
        }}
      />
    </div>
  );
}