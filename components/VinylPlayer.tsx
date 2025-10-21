import { useState, useRef, useEffect } from 'react';
import { motion, PanInfo, useAnimationControls } from 'framer-motion';
// ImageWithFallback 제거 (직접 이미지 처리로 변경)
import { Play, Pause, SkipBack, SkipForward, Search, Info, Music, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useIsMobile } from './ui/use-mobile';
import { toast } from 'sonner';
import { CommunityBoard } from './CommunityBoard';
// Supabase 관련 import 제거 (Internet Archive 직접 사용으로 불필요)

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
  license?: string; // Attribution 3.0 등 라이선스 정보
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
  const [showSearch, setShowSearch] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  // localStorage를 사용해 방문 기록 저장 (자동재생 비활성화로 단순화)
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAudioReady, setIsAudioReady] = useState(false); // 오디오 준비 상태 추가
  const [preloadedTracks, setPreloadedTracks] = useState<Map<string, HTMLAudioElement>>(new Map());
  const spinControls = useAnimationControls();
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const shouldAutoPlayRef = useRef<boolean>(false);
  const playTokenRef = useRef<number>(0); // 재생 요청 토큰 (레이스 컨디션 방지)
  const isMobile = useIsMobile();
  
  // 🎵 단순하고 안정적인 프리로딩 (브라우저 기본 캐시 의존)

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

  // 🎵 개선된 병렬 프리로딩 (더 빠른 로딩)
  useEffect(() => {
    if (tracks.length > 0) {
      // 현재 트랙부터 최대 10개까지 병렬로 사전 로딩
      const loadNextTracks = async () => {
        const tracksToPreload = [];
        for (let i = 0; i < Math.min(10, tracks.length); i++) {
          const trackIndex = (currentTrackIndex + i) % tracks.length;
          const track = tracks[trackIndex];
          
          if (track && !preloadedTracks.has(track.id)) {
            tracksToPreload.push({ track, index: i });
          }
        }
        
        console.log(`🚀 Starting parallel preload for ${tracksToPreload.length} tracks`);
        
        // 우선순위별로 로딩 (첫 3개는 즉시, 나머지는 순차적으로)
        const immediateTracks = tracksToPreload.slice(0, 3);
        const backgroundTracks = tracksToPreload.slice(3);
        
        // 즉시 로딩할 트랙들 (첫 3개) - metadata만 로딩하여 속도 향상
        const immediatePromises = immediateTracks.map(({ track, index }) => 
          new Promise<void>((resolve) => {
            const audio = new Audio();
            audio.src = track.preview_url;
            audio.preload = 'metadata'; // 🚀 metadata만 로딩 (빠름!)
            audio.crossOrigin = 'anonymous';
            
            const handleLoadedMetadata = () => {
              setPreloadedTracks(prev => new Map(prev).set(track.id, audio));
              console.log(`🎵 Immediate preload [${index + 1}/3]: ${track.title} (metadata only)`);
              audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
              audio.removeEventListener('error', handleError);
              resolve();
            };
            
            const handleError = (e: any) => {
              console.warn(`❌ Failed immediate preload: ${track.title}`, e);
              audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
              audio.removeEventListener('error', handleError);
              resolve();
            };
            
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            audio.addEventListener('error', handleError);
            
            setTimeout(() => {
              if (!preloadedTracks.has(track.id)) {
                console.warn(`⏱️ Immediate preload timeout: ${track.title}`);
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
                audio.removeEventListener('error', handleError);
                resolve();
              }
            }, 3000);
          })
        );
        
        // 백그라운드 로딩할 트랙들 (나머지) - none으로 최소화
        const backgroundPromises = backgroundTracks.map(({ track, index }) => 
          new Promise<void>((resolve) => {
            const audio = new Audio();
            audio.src = track.preview_url;
            audio.preload = 'none'; // 🚀 필요할 때만 로딩 (최소 메모리)
            audio.crossOrigin = 'anonymous';
            
            // metadata 조차 기다리지 않고 즉시 등록
            setPreloadedTracks(prev => new Map(prev).set(track.id, audio));
            console.log(`🎵 Background preload [${index + 4}/${tracksToPreload.length}]: ${track.title} (none - lazy load)`);
            
            const handleError = (e: any) => {
              console.warn(`❌ Failed background preload: ${track.title}`, e);
              audio.removeEventListener('error', handleError);
            };
            
            audio.addEventListener('error', handleError);
            
            // 즉시 resolve (로딩 대기 없음)
            resolve();
          })
        );
        
        // 즉시 로딩 완료 대기
        await Promise.all(immediatePromises);
        console.log(`✅ Immediate preload completed for ${immediateTracks.length} tracks`);
        
        // 백그라운드 로딩은 기다리지 않고 백그라운드에서 진행
        Promise.all(backgroundPromises).then(() => {
          console.log(`✅ Background preload completed for ${backgroundTracks.length} tracks`);
        });
      };
      
      loadNextTracks();
    }
  }, [tracks, currentTrackIndex]);

  // 음악 Spotify API 호출 함수
  // searchTracks 함수 제거 (장르 선택으로 대체됨)

  // 장르별 검색 쿼리 생성
  const getGenreSearchQueries = (genre: string) => {
    const baseQueries = [
      `collection:78rpm AND mediatype:audio`,
      `collection:netlabels AND mediatype:audio`,
      `collection:etree AND mediatype:audio`
    ];

    switch (genre) {
      case 'jazz':
        return [
          ...baseQueries.map(q => `${q} AND subject:(jazz OR swing OR big band)`),
          'collection:78rpm AND mediatype:audio AND (title:(jazz OR swing) OR creator:(jazz OR swing))'
        ];
      case 'classical':
        return [
          ...baseQueries.map(q => `${q} AND subject:(classical OR symphony OR orchestra)`),
          'collection:78rpm AND mediatype:audio AND (title:(classical OR symphony) OR creator:(classical OR symphony))'
        ];
      case 'blues':
        return [
          ...baseQueries.map(q => `${q} AND subject:(blues OR rhythm)`),
          'collection:78rpm AND mediatype:audio AND (title:(blues OR rhythm) OR creator:(blues OR rhythm))'
        ];
      case 'swing':
        return [
          ...baseQueries.map(q => `${q} AND subject:(swing OR big band OR dance)`),
          'collection:78rpm AND mediatype:audio AND (title:(swing OR dance) OR creator:(swing OR dance))'
        ];
      case 'folk':
        return [
          `collection:netlabels AND mediatype:audio AND subject:(folk OR acoustic)`,
          `collection:etree AND mediatype:audio AND subject:(folk OR acoustic)`
        ];
      case 'all':
      default:
        return [
          'collection:78rpm AND mediatype:audio',
          'collection:netlabels AND mediatype:audio',
          'collection:etree AND mediatype:audio'
        ];
    }
  };

  // Internet Archive Search API로 실제 음원 검색
  const searchInternetArchive = async (query: string, rows: number = 50) => {
    try {
      console.log(`🔍 Searching Internet Archive: ${query}`);
      
      // 다양한 정렬 기준을 랜덤하게 선택하여 매번 다른 곡 발견
      const sortOptions = [
        'downloads desc',
        'addeddate desc',
        'publicdate desc',
        'date desc',
        'avg_rating desc',
        'random' // 완전 랜덤
      ];
      
      const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
      
      // 랜덤 페이지 선택 (0~10 페이지 중 랜덤)
      const randomPage = Math.floor(Math.random() * 10);
      const startRow = randomPage * rows;
      
      // licenseurl 필드 추가하여 라이선스 정보도 가져오기
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=avg_rating&fl[]=licenseurl&rows=${rows}&start=${startRow}&sort[]=${encodeURIComponent(randomSort)}&output=json`;
      
      console.log(`📍 Using sort: ${randomSort}, page: ${randomPage + 1}`);
      
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
  const getStreamingUrl = async (identifier: string, item?: any) => {
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
      
      // Internet Archive의 커버 이미지 URL (항목마다 고유)
      const coverUrl = `https://archive.org/services/img/${identifier}`;
      
      // Internet Archive 커버 이미지 URL (일단 기본 URL 사용)
      let finalCoverUrl = coverUrl;
      
      // Internet Archive 기본 이미지 감지 (CORS 에러 방지)
      const checkIfDefaultImage = async (url: string) => {
        try {
          // no-cors 모드로 CORS 에러 방지
          await fetch(url, { 
            method: 'HEAD',
            mode: 'no-cors'
          });
          
          // no-cors 모드에서는 opaque response이므로 헤더 접근 불가
          // 대신 이미지를 로드해서 크기 확인
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              // 180x45 픽셀 긴 사각형 이미지 체크
              const isDefaultSize = (img.naturalWidth === 180 && img.naturalHeight === 45);
              resolve({ 
                isDefault: isDefaultSize, 
                width: img.naturalWidth, 
                height: img.naturalHeight,
                type: 'image' 
              });
            };
            img.onerror = () => {
              resolve({ isDefault: false, width: 0, height: 0, type: 'error' });
            };
            img.src = url;
          });
    } catch (error) {
          console.warn('Failed to check image:', error);
          return { isDefault: false, width: 0, height: 0, type: 'error' };
        }
      };
      
      // 기본 이미지인지 확인하고 오리로 대체
      const imageInfo = await checkIfDefaultImage(coverUrl);
      const { width, height } = imageInfo as { width: number; height: number };
      
      // 180x45 픽셀만 정확하게 체크
      const isDefaultSize = (width === 180 && height === 45);
      
      // 기본 이미지(180x45)이거나 특정 조건에서 오리 사용
      const shouldUseDuck = isDefaultSize || 
                           identifier.includes('dragnet') || 
                           item?.title?.toLowerCase().includes('radio') ||
                           item?.title?.toLowerCase().includes('episode') ||
                           (Array.isArray(item?.creator) ? item.creator.join(' ').toLowerCase() : item?.creator?.toLowerCase?.() || '').includes('radio');
      
      if (shouldUseDuck) {
        finalCoverUrl = '/images/hi.png';
        console.log(`🦆 Using duck fallback for ${identifier} (${width}x${height})`);
      }
      // 오리 사용하지 않는 경우는 로그 출력하지 않음
      
      // console.log(`✅ Streaming URL found: ${audioFile.name}`); // 로그 정리
      
      return {
        streamingUrl,
        coverUrl: finalCoverUrl,
        duration: audioFile.length ? parseInt(audioFile.length) * 1000 : 180000, // length in seconds
        fileSize: audioFile.size
      };
    } catch (error) {
      console.error(`❌ Failed to get streaming URL for ${identifier}:`, error);
      throw error;
    }
  };

  // 초기 트랙 로딩 (랜덤 장르 믹스로 다양성 확보)
  const loadRecommendations = async () => {
    // 매번 다른 장르를 랜덤하게 선택하여 다양한 음악 발견
    const genres = ['jazz', 'classical', 'blues', 'swing', 'folk', 'all'];
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];
    
    console.log(`🎲 Randomly selected genre: ${randomGenre}`);
    await loadTracksByGenre(randomGenre);
  };

  // 장르별 트랙 로딩 함수
  const loadTracksByGenre = async (genre: string = 'all') => {
    try {
      setIsLoading(true);
      console.log(`🎵 Loading ${genre} tracks from Internet Archive...`);
      
      // 선택된 장르에 따른 검색 쿼리 생성
      const searchQueries = getGenreSearchQueries(genre);
      
      let allItems: any[] = [];
      
      // 여러 검색어로 충분한 결과 확보 (빠른 로딩을 위해 15개로 축소)
      for (const query of searchQueries) {
        try {
          const items = await searchInternetArchive(query, 15);
          allItems = allItems.concat(items);
        } catch (error) {
          console.warn(`Search query failed: ${query}`, error);
        }
      }
      
      // 중복 제거 및 음악 필터링
      const uniqueItems = allItems.filter((item, index, self) => 
        index === self.findIndex(t => t.identifier === item.identifier)
      );
      
      // 턴테이블에 적합한 음악만 필터링
      const musicItems = uniqueItems.filter(item => {
        // 1. Attribution 3.0 라이선스 체크 (가장 중요!)
        const licenseUrl = String(item.licenseurl || '').toLowerCase();
        const hasAttribution3 = licenseUrl.includes('creativecommons.org/licenses/by/3.0') ||
                                licenseUrl.includes('attribution') ||
                                licenseUrl.includes('publicdomain') ||
                                licenseUrl === ''; // 라이선스 정보가 없으면 Public Domain으로 간주
        
        if (!hasAttribution3 && licenseUrl) {
          console.log(`⚠️ Skipping ${item.identifier} - Invalid license: ${licenseUrl}`);
          return false;
        }
        
        // 2. 안전한 문자열 변환 (creator가 배열일 수 있음)
        const title = String(item.title || '').toLowerCase();
        const creator = Array.isArray(item.creator) 
          ? item.creator.join(', ').toLowerCase()
          : String(item.creator || '').toLowerCase();
        
        // 2-1. .com이 포함된 트랙 제외 (광고성 트랙 필터링)
        if (title.includes('.com')) {
          console.log(`⚠️ Skipping ${item.identifier} - Contains .com in title: ${title}`);
          return false;
        }
        
        // 3. 오디오북, 라디오 드라마, 팟캐스트 등 제외 키워드
        const excludeKeywords = [
          'audiobook', 'podcast', 'radio drama', 'lecture', 'speech', 
          'story', 'book', 'reading', 'narration', 'episode', 'season',
          'part 1', 'part 2', 'chapter', 'series', 'broadcast',
          'interview', 'conversation', 'discussion', 'talk', 'show',
          'news', 'documentary', 'educational', 'instructional'
        ];
        
        // 제외 키워드가 포함된 경우 필터링
        const hasExcludeKeyword = excludeKeywords.some(keyword => 
          title.includes(keyword) || creator.includes(keyword)
        );
        
        // 4. 턴테이블에 적합한 음악 키워드가 있는지 확인
        const musicKeywords = [
          'song', 'music', 'jazz', 'blues', 'classical', 'swing',
          'band', 'orchestra', 'singer', 'vocal', 'instrumental',
          'album', 'single', 'recording', 'performance', 'concert'
        ];
        
        const hasMusicKeyword = musicKeywords.some(keyword => 
          title.includes(keyword) || creator.includes(keyword)
        );
        
        // 5. 최종 판단: 라이선스 OK + 제외 키워드 없음 + (음악 키워드 있음 or 78rpm 컬렉션)
        const isValid = !hasExcludeKeyword && (hasMusicKeyword || item.identifier.includes('78rpm'));
        
        if (isValid && licenseUrl) {
          console.log(`✅ Valid track with license: ${item.title} - ${licenseUrl}`);
        }
        
        return isValid;
      });
      
      console.log(`📊 Found ${uniqueItems.length} total items, ${musicItems.length} music items from Internet Archive`);
      
      // 음악 아이템이 있으면 음악만 사용, 없으면 전체 사용 (7분 이상 필터링 고려하여 6개 선택)
      const itemsToUse = musicItems.length > 0 ? musicItems : uniqueItems;
      const shuffledItems = [...itemsToUse].sort(() => Math.random() - 0.5);
      const selectedItems = shuffledItems.slice(0, 25);
      
      const archiveTracks: Track[] = [];
      
      // 1단계: 먼저 3개 트랙만 빠르게 로딩
      for (let i = 0; i < selectedItems.length && archiveTracks.length < 3; i++) {
        const item = selectedItems[i];
        try {
          // console.log(`🔄 Loading track ${i + 1}/${selectedItems.length}: ${item.title || item.identifier}`); // 로그 정리
          
          const { streamingUrl, coverUrl, duration } = await getStreamingUrl(item.identifier, item);
          
          // 7분(420초) 이상인 긴 트랙 제외 (로딩 시간 단축)
          if (duration > 420000) { // duration은 밀리초 단위 (420초 = 7분)
            console.log(`⚠️ Skipping long track (${Math.floor(duration/60000)}분): ${item.title}`);
            continue;
          }
          
          const track: Track = {
            id: item.identifier,
            title: item.title || 'Unknown Title',
            artist: item.creator || 'Unknown Artist',
            album: item.identifier,
            cover: coverUrl, // Internet Archive 커버 사용
            preview_url: streamingUrl,
            duration: duration,
            spotify_url: `https://open.spotify.com/search/${encodeURIComponent(item.title || '')}`,
            lyrics: `From Internet Archive\nClassic audio recording\nPublic domain music`,
            genre: 'Classical',
            license: item.licenseurl || 'Public Domain' // Attribution 3.0 등 라이선스 정보
          };
          
          archiveTracks.push(track);
          // console.log(`✅ Track ${i + 1} ready: ${track.title} - ${track.artist}`); // 로그 정리
          
          // 첫 번째 트랙이 로드되면 UI에 반영하고 완전히 준비될 때까지 대기
          if (archiveTracks.length === 1) {
            setTracks([track]);
            setCurrentTrackIndex(0);
            console.log('🎵 First track loaded - Ready to play (manual start)');
            
            // 첫 번째 트랙 로딩 완료 - 오디오 재생 준비 대기
            console.log('✅ First track loaded - waiting for audio ready');
          } else {
            // 나머지 트랙들은 짧은 간격으로 로딩
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
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
      
      // 2단계: 3개 트랙 로딩 완료 후 백그라운드에서 추가 트랙 로딩
      if (archiveTracks.length >= 3) {
        console.log('🚀 Starting background loading of additional tracks...');
        
        // 백그라운드에서 추가 트랙 로딩 (비동기)
        setTimeout(async () => {
          const additionalTracks: Track[] = [];
          
          // 나머지 항목들로 추가 트랙 로딩 (최대 17개 더)
          for (let i = 3; i < selectedItems.length && additionalTracks.length < 17; i++) {
            const item = selectedItems[i];
            try {
              const { streamingUrl, coverUrl, duration } = await getStreamingUrl(item.identifier, item);
              
              // 7분(420초) 이상인 긴 트랙 제외
              if (duration > 420000) {
                console.log(`⚠️ Skipping long track (${Math.floor(duration/60000)}분): ${item.title}`);
                continue;
              }
              
              const track: Track = {
                id: item.identifier,
                title: item.title || 'Unknown Title',
                artist: item.creator?.[0] || 'Unknown Artist',
                album: 'Internet Archive',
                cover: coverUrl,
                preview_url: streamingUrl,
                duration: Math.floor(duration / 1000),
                spotify_url: '',
                lyrics: '',
                genre: genre,
                license: item.licenseurl || 'Public Domain'
              };
              
              additionalTracks.push(track);
              console.log(`🎵 Background loaded: ${track.title} - ${track.artist}`);
              
            } catch (error) {
              console.log(`❌ Failed to load additional track: ${item.title}`);
            }
          }
          
          // 추가 트랙들을 플레이리스트에 추가
          if (additionalTracks.length > 0) {
            setTracks(prevTracks => [...prevTracks, ...additionalTracks]);
            console.log(`✅ Added ${additionalTracks.length} additional tracks to playlist`);
          }
        }, 2000); // 2초 후 시작
      }
      
      // 첫 로딩 완료 플래그 업데이트
      setIsFirstLoad(false);
      setIsInitialLoading(false);
      
    } catch (error) {
      console.error('❌ Failed to load tracks:', error);
      toast.error(`Failed to load tracks: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  // 안전한 재생 함수 (레이스 컨디션 방지)
  const safePlay = async (): Promise<boolean> => {
    if (!audioRef.current) return false;
    
    const token = ++playTokenRef.current;
    try {
      await audioRef.current.play();
      // 토큰이 여전히 최신인지 확인
      if (playTokenRef.current !== token) {
        console.log('🎵 Play request was superseded by newer request');
        return false;
      }
      return true;
    } catch (error: any) {
      if (playTokenRef.current !== token) {
        console.log('🎵 Play request was superseded by newer request');
        return false;
      }
      
      if (error.name === 'AbortError') {
        console.log('🎵 Play request was aborted (normal behavior)');
        return false;
      }
      
      console.warn('🎵 Play failed:', error.name, error.message);
      return false;
    }
  };


  // 서버 상태 체크
  // checkServerHealth 함수 제거 (Internet Archive 직접 사용으로 불필요)

  // Load tracks from Spotify API with retry
  useEffect(() => {
    // Toast system test
    setTimeout(() => {
      console.log('VinylPlayer Started - Ready to play music');
    }, 500);

    // 첫 곡은 수동 재생이므로 자동재생 이벤트 리스너 불필요
    
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

  // 오디오가 재생 준비되면 로딩 완료
  useEffect(() => {
    if (isAudioReady) {
      console.log('🎵 Audio ready - hiding loading indicator');
      setTracksLoading(false);
    }
  }, [isAudioReady]);

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

    // 시간 업데이트 핸들러 (동기화 개선 + 디버깅)
    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      if (!isNaN(time) && isFinite(time)) {
        console.log(`🎵 TimeUpdate: ${time.toFixed(2)}s (duration: ${audio.duration?.toFixed(2)}s)`);
        setCurrentTime(time);
        
        // 🚨 timeupdate 이벤트가 발생하면 duration도 함께 업데이트
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      }
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
      setIsAudioReady(false); // 새 트랙 로딩 시작 시 준비 상태 초기화
    };
    
    const handleCanPlay = () => {
      console.log('Audio can play');
      setIsLoading(false);
      setIsAudioReady(true); // 오디오가 재생 준비 완료
      
      // 🚀 음원 다운로드 완료 시 자동재생 (사용자 요청) - 조건 단순화
      if (audio && !isPlaying && audio.readyState >= 2) {
        console.log('🎵 Audio ready - attempting smart auto-play');
        audio.play().then(() => {
          console.log('✅ Smart auto-play successful');
          setIsPlaying(true);
        }).catch((error: any) => {
          console.log('⚠️ Smart auto-play failed (normal):', error.name);
          // 자동재생 실패는 정상적인 동작 (사용자 상호작용 필요)
        });
      }
    };
    
    const handleLoadedData = () => {
      console.log('Audio data loaded');
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsAudioReady(true); // 메타데이터 로드 완료
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
      
      // 🚨 재생 시작 즉시 강제 시간 업데이트 (무조건)
      if (audio) {
        const currentTime = audio.currentTime || 0;
        console.log(`🚀 GUARANTEED Play start - forcing time update: ${currentTime.toFixed(2)}s`);
        setCurrentTime(currentTime);
        
        // duration도 강제 업데이트
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
        
        // 연속으로 3번 강제 업데이트 (확실하게)
        setTimeout(() => {
          if (audio && !audio.paused) {
            const time = audio.currentTime || 0;
            setCurrentTime(time);
            console.log(`🚀 GUARANTEED Update 1: ${time.toFixed(2)}s`);
          }
        }, 100);
        
        setTimeout(() => {
          if (audio && !audio.paused) {
            const time = audio.currentTime || 0;
            setCurrentTime(time);
            console.log(`🚀 GUARANTEED Update 2: ${time.toFixed(2)}s`);
          }
        }, 200);
        
        setTimeout(() => {
          if (audio && !audio.paused) {
            const time = audio.currentTime || 0;
            setCurrentTime(time);
            console.log(`🚀 GUARANTEED Update 3: ${time.toFixed(2)}s`);
          }
        }, 300);
      }
      
      // LP 회전은 useEffect에서 자동 처리됨
    };

    const handlePause = () => {
      console.log('🎵 Audio paused');
      setIsPlaying(false);
      // LP 회전은 useEffect에서 자동 처리됨
    };

    // 모든 이벤트 리스너 등록 (timeupdate 추가 - 동기화 개선)
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    // 🚨 완전히 조건 없는 타임라인 타이머
    let mainTimer: NodeJS.Timeout | null = null;
    
    // 무조건 타이머 시작 (모든 조건 제거)
    console.log('🚀 Starting ABSOLUTE GUARANTEED timeline timer');
    mainTimer = setInterval(() => {
      // 오디오가 있든 없든 무조건 실행
      if (audio) {
        const currentAudioTime = audio.currentTime || 0;
        const audioDuration = audio.duration || 0;
        const isPlaying = !audio.paused && !audio.ended;
        
        // 무조건 시간 업데이트 (모든 조건 제거)
        setCurrentTime(currentAudioTime);
        setDuration(audioDuration);
        
        // 재생 중일 때는 더 자주 로그 출력
        if (isPlaying) {
          console.log(`⏰ ABSOLUTE Timer (PLAYING): ${currentAudioTime.toFixed(2)}s / ${audioDuration.toFixed(2)}s (readyState: ${audio.readyState})`);
        } else {
          console.log(`⏰ ABSOLUTE Timer (PAUSED): ${currentAudioTime.toFixed(2)}s / ${audioDuration.toFixed(2)}s (readyState: ${audio.readyState})`);
        }
      } else {
        // 오디오가 없어도 0으로 설정
        setCurrentTime(0);
        setDuration(0);
        console.log('⏰ No audio - setting time to 0');
      }
    }, 50); // 50ms로 더 빠르게 (재생 중일 때 더 부드럽게)

    return () => {
      // 클린업 강화 - 모든 리스너 제거
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      
      // 🚨 메인 타이머도 반드시 해제
      if (mainTimer) {
        clearInterval(mainTimer);
      }
    };
  }, [currentTrackIndex, isPlaying]); // isPlaying 추가 - 타이머 제어용

  // 🚨 컴포넌트 마운트 시 타임라인 강제 시작
  useEffect(() => {
    console.log('🚀 Component mounted - forcing timeline start');
    
    // 마운트 시 즉시 타임라인 상태 초기화
    setCurrentTime(0);
    setDuration(0);
    
    // 500ms 후에도 강제로 타임라인 체크
    const forceTimelineCheck = setTimeout(() => {
      if (audioRef.current) {
        const time = audioRef.current.currentTime || 0;
        const duration = audioRef.current.duration || 0;
        setCurrentTime(time);
        setDuration(duration);
        console.log(`🚀 Force timeline check: ${time.toFixed(2)}s / ${duration.toFixed(2)}s`);
      } else {
        console.log('🚀 Force timeline check: No audio element');
      }
    }, 500);
    
    return () => {
      clearTimeout(forceTimelineCheck);
    };
  }, []); // 컴포넌트 마운트 시 한 번만 실행

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

  // 트랙 변경 시 자동 재생 처리 (네트워크 오류 재시도 로직 포함)
  useEffect(() => {
    if (!currentTrack) return;

    const setupNewTrack = async () => {
      const MAX_RETRIES = 2; // 최대 2번 재시도
      let retryCount = 0;
      
      while (retryCount <= MAX_RETRIES) {
        try {
          setIsLoading(true);
          setCurrentTime(0);
          setDuration(0);
          
          if (audioRef.current) {
            // 이전 재생을 확실히 중단하고 토큰 무효화
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            playTokenRef.current++; // 이전 재생 요청 무효화
            
            // 사전 로딩된 오디오가 있는지 확인
            const preloadedAudio = preloadedTracks.get(currentTrack.id);
            
            if (preloadedAudio) {
              console.log('✅ Using preloaded audio for:', currentTrack.title);
              // 사전 로딩된 오디오의 속성을 현재 오디오에 복사
              audioRef.current.src = preloadedAudio.src;
              audioRef.current.currentTime = 0;
              // 사전 로딩된 오디오는 이미 로드되어 있음
            } else if (isValidPreviewUrl(currentTrack.preview_url)) {
              console.log('✅ Setting preview URL:', currentTrack.preview_url);
              audioRef.current.src = currentTrack.preview_url!;
              audioRef.current.load(); // 강제로 오디오 로드
            } else {
              console.log('⚠️ Invalid preview URL, removing audio source:', currentTrack.preview_url);
              audioRef.current.removeAttribute('src');
              audioRef.current.load();
            }
          }
          
          console.log(`🎵 Setting up track: ${currentTrack.title} (시도 ${retryCount + 1}/${MAX_RETRIES + 1})`);
          
          // 새 트랙 설정 시 오디오 준비 상태 초기화
          setIsAudioReady(false);
          
          // 자동재생 여부 결정
          let shouldAutoPlay = false;
          
          // 1. shouldAutoPlayRef가 true면 무조건 자동재생 (이전에 재생 중이었음)
          if (shouldAutoPlayRef.current) {
            shouldAutoPlay = true;
            shouldAutoPlayRef.current = false; // 사용 후 리셋
            console.log('🎵 Auto-play enabled (was playing before track change)');
          }
          // 2. 첫 곡 로딩 시 - 자동재생 활성화 (사용자 요청)
          else if (isFirstLoad && currentTrackIndex === 0) {
            // 첫 트랙도 자동재생으로 시작
            shouldAutoPlay = true;
            console.log('🎵 First track loaded - auto-play enabled');
            
            // isFirstLoad 플래그 업데이트
            setIsFirstLoad(false);
            
            // 방문 기록 저장 (선택사항)
            try {
              localStorage.setItem('vinylplayer_visited', 'true');
            } catch (error) {
              console.warn('Failed to save visit record:', error);
            }
          }
          
          // 자동재생 시도
          if (shouldAutoPlay && audioRef.current && isValidPreviewUrl(currentTrack.preview_url)) {
            // 사전 로딩된 오디오인지 확인
            const preloadedAudio = preloadedTracks.get(currentTrack.id);
            
            // 오디오 로딩 대기 (타임아웃 포함)
            const waitForLoad = new Promise<void>((resolve, reject) => {
              if (!audioRef.current) return resolve();
              
              if (preloadedAudio) {
                // 사전 로딩된 오디오는 즉시 재생 가능
                console.log('⚡ Preloaded audio - instant play');
                resolve();
              } else {
              const handleCanPlay = () => {
                audioRef.current?.removeEventListener('canplay', handleCanPlay);
                resolve();
              };
                
                const handleError = () => {
                  audioRef.current?.removeEventListener('error', handleError);
                  reject(new Error('Audio loading failed'));
                };
                
                // 로딩 타임아웃 (12초)
                const timeoutId = setTimeout(() => {
                  audioRef.current?.removeEventListener('canplay', handleCanPlay);
                  audioRef.current?.removeEventListener('error', handleError);
                  reject(new Error('Audio loading timeout'));
                }, 12000);
              
              if (audioRef.current.readyState >= 2) {
                  clearTimeout(timeoutId);
                resolve();
              } else {
                audioRef.current.addEventListener('canplay', handleCanPlay);
                  audioRef.current.addEventListener('error', handleError);
                }
              }
            });
            
            try {
              await waitForLoad;
              if (audioRef.current) {
                try {
                  // 음소거 상태로 먼저 재생 시도 (브라우저 정책 우회)
                  audioRef.current.muted = true;
                  console.log('🎵 Attempting auto-play (muted)...');
                  await audioRef.current.play();
                  console.log('✅ Auto-play successful!');
                  
                  // 즉시 상태 업데이트 (LP 회전은 useEffect에서 자동 처리됨)
                  setIsPlaying(true);
                  
                  // 🚨 자동재생 성공 시 즉시 시간 업데이트 (첫 트랙 문제 해결)
                  if (audioRef.current && !isNaN(audioRef.current.currentTime)) {
                    console.log(`🚀 Auto-play success - immediate time update: ${audioRef.current.currentTime.toFixed(2)}s`);
                    setCurrentTime(audioRef.current.currentTime);
                  }
                  
                  // 재생 성공 후 즉시 음소거 해제
                  setTimeout(() => {
                    if (audioRef.current) {
                      audioRef.current.muted = false;
                      audioRef.current.volume = Math.max(0, Math.min(1, (volume || 75) / 100));
                      console.log('🔊 Unmuted - Now playing:', currentTrack.title);
                    }
                  }, 100);
                  
                  // 성공했으므로 재시도 루프 탈출
                  return;
                  
                } catch (playError: any) {
                  // AbortError는 정상적인 중단이므로 조용히 처리
                  if (playError.name === 'AbortError') {
                    console.log('🎵 Auto-play was aborted (normal behavior during track change)');
                    return;
                  } else {
                    console.warn('⚠️ Auto-play failed:', playError.name, playError.message);
                    // 재생 실패 시 사용자에게 알림 (토스트는 표시하지 않음 - 재생 버튼으로 유도)
                  }
                  setIsPlaying(false);
                  // 음소거 해제
                  if (audioRef.current) {
                    audioRef.current.muted = false;
                  }
                  return;
                }
              }
            } catch (error: any) {
              // 로딩 실패는 로그만 남김 (타임아웃은 정상적인 동작일 수 있음)
              if (error.message !== 'Audio loading timeout') {
                console.error('❌ Auto-play error:', error);
              } else {
                console.warn('⏱️ Auto-play loading timeout - track may still be loading');
              }
              setIsPlaying(false);
              return;
            }
          }
          
          // 여기까지 도달하면 성공적으로 로딩됨
          return;
          
        } catch (error: any) {
          retryCount++;
          console.error(`❌ Track loading failed (시도 ${retryCount}/${MAX_RETRIES + 1}):`, error.message);
          
          // 네트워크 오류인지 확인
          const isNetworkError = error.message.includes('ERR_CONNECTION_RESET') || 
                                error.message.includes('ERR_NETWORK_CHANGED') ||
                                error.message.includes('ERR_INTERNET_DISCONNECTED') ||
                                error.message.includes('Failed to fetch') ||
                                error.message.includes('Audio loading failed');
          
          if (retryCount <= MAX_RETRIES && isNetworkError) {
            console.log(`🔄 네트워크 오류 감지 - ${1000 * retryCount}ms 후 재시도...`);
            // 재시도 전 대기 (지수 백오프)
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          } else {
            // 최대 재시도 횟수를 초과하거나 네트워크 오류가 아닌 경우
            console.error('❌ 최대 재시도 횟수 초과 또는 치명적 오류');
            setIsPlaying(false);
            break;
          }
        } finally {
          if (retryCount > MAX_RETRIES) {
            setIsLoading(false);
          }
        }
      }
      
      // 모든 재시도가 실패한 경우
      if (retryCount > MAX_RETRIES) {
        console.error('❌ 모든 재시도 실패 - 다음 트랙으로 넘어가거나 사용자에게 알림');
        // 선택적: 사용자에게 알림
        // toast.error('네트워크 연결 오류로 음원 재생에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
    try {
      // 오디오가 실제로 재생 중이거나 로딩 중일 때 회전
      const isAudioPlaying = audioRef.current && !audioRef.current.paused;
      const shouldRotate = isPlaying || isLoading || isAudioPlaying;
      
      if (shouldRotate) {
        console.log('🎵 Starting LP rotation animation');
      spinControls.start({
        rotate: [0, 360],
        transition: {
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }
      });
      } else if (spinControls) {
        console.log('⏸️ Stopping LP rotation animation');
      spinControls.stop();
    }
    } catch (error) {
      console.warn('LP animation control error:', error);
    }
  }, [isPlaying, isLoading, isInitialLoading, spinControls, currentTrackIndex]);

  // 트랙 변경 시 진행상황 강제 초기화 (동기화 개선)
  useEffect(() => {
    console.log('🔄 Track changed - resetting progress');
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    
    // 오디오 엘리먼트도 강제 초기화
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  }, [currentTrackIndex]);

  // 에러 토스트 표시 (훅은 최상위 레벨에서 호출)
  useEffect(() => {
    if (!currentTrack && tracks.length === 0 && !tracksLoading) {
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
    }
  }, [currentTrack, tracks.length, tracksLoading]);

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

    try {
      // 오디오가 실제로 재생 중인지 확인
      const isAudioPlaying = audioRef.current && !audioRef.current.paused;
      
      // 재생 중이거나 로딩 중일 때 pause 처리
      if (isPlaying || isLoading || isAudioPlaying) {
        console.log('⏸️ Pausing...');
        if (audioRef.current) {
          audioRef.current.pause();
          // handlePause 이벤트에서 setIsPlaying(false) 처리됨
        }
        // 로딩 중단
        if (isLoading) {
          setIsLoading(false);
          console.log('⏹️ Loading stopped');
        }
      } else {
        // 재생하려고 하는데 트랙이 없는 경우
        if (!currentTrack) {
          toast.error('No tracks available. Please load some tracks first.');
          return;
        }
        
        console.log('▶️ Attempting to play:', currentTrack.title);
        setIsLoading(true);
        audioRef.current.volume = volume / 100;
        
        // 🚀 재생 시점에 전체 오디오 로딩 시작 (성능 최적화)
        if (audioRef.current && audioRef.current.preload !== 'auto') {
          console.log('🚀 Switching to full audio preload for immediate playback');
          audioRef.current.preload = 'auto';
        }
        
        // 오디오가 준비되지 않았으면 로딩 완료 대기
        if (!isAudioReady) {
          console.log('⏳ Audio not ready yet, waiting for loading...');
          toast('Loading track...', { duration: 2000 });
          
          // 최대 8초 대기
          const waitForReady = new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('⏱️ Audio loading timeout after 8 seconds');
              resolve(false);
            }, 8000);
            
            // 100ms마다 확인
            const checkReady = setInterval(() => {
              if (isAudioReady || (audioRef.current && audioRef.current.readyState >= 2)) {
                clearTimeout(timeout);
                clearInterval(checkReady);
                resolve(true);
              }
            }, 100);
          });
          
          const ready = await waitForReady;
          if (!ready) {
            toast.error('Track loading timeout. Please try again.');
            setIsLoading(false);
            return;
          }
        }
        
        // 재시도 로직이 포함된 안전한 재생 시도
        const MAX_RETRIES = 2;
        let retryCount = 0;
        let playSuccess = false;
        
        while (retryCount <= MAX_RETRIES && !playSuccess) {
          try {
            console.log(`🎵 Attempting play (시도 ${retryCount + 1}/${MAX_RETRIES + 1})`);
            playSuccess = await safePlay();
            
            if (playSuccess) {
              console.log('🎵 Playing started successfully');
              
              // 🚨 수동 재생 성공 시 GUARANTEED 시간 업데이트
              if (audioRef.current) {
                const currentTime = audioRef.current.currentTime || 0;
                console.log(`🚀 GUARANTEED Manual play - forcing time update: ${currentTime.toFixed(2)}s`);
                setCurrentTime(currentTime);
                
                // duration도 강제 업데이트
                if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                  setDuration(audioRef.current.duration);
                }
                
                // 연속으로 5번 강제 업데이트 (수동 재생은 더 확실하게)
                for (let i = 1; i <= 5; i++) {
                  setTimeout(() => {
                    if (audioRef.current && !audioRef.current.paused) {
                      const time = audioRef.current.currentTime || 0;
                      setCurrentTime(time);
                      console.log(`🚀 GUARANTEED Manual Update ${i}: ${time.toFixed(2)}s`);
                    }
                  }, i * 100); // 100ms, 200ms, 300ms, 400ms, 500ms
                }
              }
              
              // 상태는 handlePlay에서 업데이트됨
              break;
            } else {
              console.log('🎵 Play request failed or was superseded');
              break;
            }
          } catch (playError: any) {
            retryCount++;
            console.error(`❌ Play attempt ${retryCount} failed:`, playError.message);
            
            // 네트워크 오류인지 확인
            const isNetworkError = playError.message.includes('ERR_CONNECTION_RESET') || 
                                  playError.message.includes('ERR_NETWORK_CHANGED') ||
                                  playError.message.includes('ERR_INTERNET_DISCONNECTED') ||
                                  playError.message.includes('Failed to fetch');
            
            if (retryCount <= MAX_RETRIES && isNetworkError) {
              console.log(`🔄 네트워크 오류 감지 - ${1000 * retryCount}ms 후 재시도...`);
              // 재시도 전 대기 (지수 백오프)
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
              // 최대 재시도 횟수를 초과하거나 네트워크 오류가 아닌 경우
              throw playError;
            }
          }
        }
        
        if (!playSuccess) {
          setIsLoading(false);
          setIsPlaying(false);
        }
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
      } else if (error.message === 'Load timeout' || error.message === 'Audio loading timeout') {
        toast.error('Track loading timeout - trying next track');
        // 타임아웃 시 다음 재생 트랙으로 넘어가기
        const nextIndex = findNextPlayableTrack(currentTrackIndex);
        if (nextIndex !== -1) {
          setCurrentTrackIndex(nextIndex);
        } else {
          toast.error('No more tracks available');
        }
      } else if (error.name === 'AbortError') {
        // AbortError는 트랙 변경 시 정상적인 동작이므로 무시
        console.log('🎵 Audio playback was interrupted (normal behavior)');
        // AbortError는 토스트나 상태 변경 없이 조용히 처리
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
    
    const wasPlaying = isPlaying;
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
    
    const wasPlaying = isPlaying;
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
    
    // 즉각적으로 UI 업데이트 (timeupdate 이벤트 기다리지 않음)
    setCurrentTime(newTime);
    audioRef.current.currentTime = newTime;
  };


  // 장르 선택 핸들러
  const handleGenreSelect = async (genre: string) => {
    try {
      setShowSearch(false); // 모달 닫기
      
      // 선택된 장르로 트랙 로딩
      await loadTracksByGenre(genre);
      
      // 장르명 표시
      const genreNames: { [key: string]: string } = {
        'all': 'All Genres',
        'jazz': 'Jazz',
        'classical': 'Classical',
        'blues': 'Blues',
        'swing': 'Swing',
        'folk': 'Folk'
      };
      
      toast.success(`Loading ${genreNames[genre]} tracks...`);
      
    } catch (error) {
      console.error('Genre selection failed:', error);
      toast.error('Failed to load genre tracks');
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };




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
    <div className={`flex flex-col h-screen overflow-hidden relative ${isMobile ? 'pt-0' : 'p-8 justify-center items-center'}`}>
      {/* 배경 레이어 */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-100 z-0" />
      
      {/* 콘텐츠 레이어 */}
      <div className="relative z-10 w-full h-full flex flex-col">
      
      {/* Show loading state while tracks are being loaded */}
      {tracksLoading && (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 relative z-50">
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
      )}

      {/* Show error state if no tracks available */}
      {!tracksLoading && !currentTrack && tracks.length === 0 && (
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
      )}

      {/* Main player content */}
      {!tracksLoading && currentTrack && (
        <>
      
      {/* Community Board Button - Desktop: aligned with content, Mobile: fixed top-right */}
      <button
        onClick={() => setShowBoard(true)}
        className={`${
          isMobile 
            ? 'fixed top-4 right-4' 
            : 'fixed top-[calc(1rem+50px)] right-[calc((100vw-896px)/2-20px)]'
        } z-50 group`}
        aria-label="Open Community Board"
      >
        <div className="relative">
          {/* Background circle with opacity and subtle shadow */}
          <div 
            className="w-12 h-12 bg-white rounded-full opacity-25 group-hover:opacity-40 transition-opacity duration-200"
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}
          />
          
          {/* Message bubble icon */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <MessageCircle className="w-5 h-5 text-black group-hover:text-gray-800 transition-colors duration-200" />
          </div>
        </div>
      </button>
      
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
                  // 모바일에서 터치 이벤트 처리 (passive 경고 방지)
                  if (isMobile) {
                    // passive 이벤트 리스너에서는 preventDefault 호출하지 않음
                    // 대신 터치 동작을 다른 방식으로 처리
                    e.stopPropagation();
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
                  <img 
                    src={currentTrack?.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjcwIiBmaWxsPSIjRkZGNzAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iNCIvPgo8Y2lyY2xlIGN4PSI4NSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxjaXJjbGUgY3g9IjExNSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxwYXRoIGQ9Ik0xMDAgMTIwIEwxMDAgMTEwIEw5MCAxMTUgTDEwMCAxMjBaIiBmaWxsPSIjRkY2NjAwIi8+CjxwYXRoIGQ9Ik05MCAxNjAgUTEwMCAxNTUgMTEwIDE2MCBMOTAgMTYwWiIgZmlsbD0iIzAwMCIvPgo8L3N2Zz4K'}
                    alt={`${currentTrack?.album || 'Music Loading'} cover`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      console.log('🦆 Image failed, using duck fallback');
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjcwIiBmaWxsPSIjRkZGNzAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iNCIvPgo8Y2lyY2xlIGN4PSI4NSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxjaXJjbGUgY3g9IjExNSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxwYXRoIGQ9Ik0xMDAgMTIwIEwxMDAgMTEwIEw5MCAxMTUgTDEwMCAxMjBaIiBmaWxsPSIjRkY2NjAwIi8+CjxwYXRoIGQ9Ik05MCAxNjAgUTEwMCAxNTUgMTEwIDE2MCBMOTAgMTYwWiIgZmlsbD0iIzAwMCIvPgo8L3N2Zz4K';
                    }}
                  />
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
              {/* 제목 - 2줄 넘으면 ... 처리 */}
              <h2 className="text-gray-900 mb-1 leading-tight" style={{ fontSize: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {currentTrack?.title || 'No Track Selected'}
              </h2>
              
              {/* 아티스트 */}
              <p className="text-gray-600 leading-tight" style={{ fontSize: '1.125rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
              >
                {isPlaying || isLoading ? (
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

              {/* 5번 곡정보 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLyrics(!showLyrics)}
                className={`w-10 h-10 justify-self-center ${showLyrics ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}
                disabled={!currentTrack}
              >
                <Info className="w-5 h-5" />
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
                  <img 
                    src={currentTrack?.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjcwIiBmaWxsPSIjRkZGNzAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iNCIvPgo8Y2lyY2xlIGN4PSI4NSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxjaXJjbGUgY3g9IjExNSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxwYXRoIGQ9Ik0xMDAgMTIwIEwxMDAgMTEwIEw5MCAxMTUgTDEwMCAxMjBaIiBmaWxsPSIjRkY2NjAwIi8+CjxwYXRoIGQ9Ik05MCAxNjAgUTEwMCAxNTUgMTEwIDE2MCBMOTAgMTYwWiIgZmlsbD0iIzAwMCIvPgo8L3N2Zz4K'}
                    alt={`${currentTrack?.album || 'Music Loading'} cover`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      console.log('🦆 Image failed, using duck fallback');
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjcwIiBmaWxsPSIjRkZGNzAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iNCIvPgo8Y2lyY2xlIGN4PSI4NSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxjaXJjbGUgY3g9IjExNSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxwYXRoIGQ9Ik0xMDAgMTIwIEwxMDAgMTEwIEw5MCAxMTUgTDEwMCAxMjBaIiBmaWxsPSIjRkY2NjAwIi8+CjxwYXRoIGQ9Ik05MCAxNjAgUTEwMCAxNTUgMTEwIDE2MCBMOTAgMTYwWiIgZmlsbD0iIzAwMCIvPgo8L3N2Zz4K';
                    }}
                  />
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
                <h2 className="text-gray-900 mb-1 leading-tight" style={{ fontSize: '1.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {currentTrack?.title || 'No Track Selected'}
                </h2>
                <p className="text-gray-600 mb-0.5 leading-tight" style={{ fontSize: '1.25rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {currentTrack?.artist || 'Load tracks to start playing'}
                </p>
                <p className="text-gray-500 leading-tight" style={{ fontSize: '1rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
                >
                  {isPlaying || isLoading ? (
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

                {/* 곡정보 버튼 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={`w-12 h-12 ${showLyrics ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}
                  disabled={!currentTrack}
                >
                  <Info className="w-6 h-6" />
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
            <div className={`bg-white rounded-2xl p-8 w-full mx-4 ${isMobile ? 'max-w-[calc(100vw-2rem)]' : 'max-w-md'}`}>
              <div className="text-center mb-6">
                <h3 className="text-xl font-medium text-gray-900 mb-2">Select Genre</h3>
                <p className="text-sm text-gray-500">Select your favorite music genre</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleGenreSelect('all')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  <div className="font-medium text-gray-900">All Genres</div>
                  <div className="text-xs text-gray-500">Mixed selection</div>
                </button>
                
                <button
                  onClick={() => handleGenreSelect('jazz')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  <div className="font-medium text-gray-900">Jazz</div>
                  <div className="text-xs text-gray-500">Swing & Big Band</div>
                </button>
                
                <button
                  onClick={() => handleGenreSelect('classical')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  <div className="font-medium text-gray-900">Classical</div>
                  <div className="text-xs text-gray-500">Symphony & Orchestra</div>
                </button>
                
                <button
                  onClick={() => handleGenreSelect('blues')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  <div className="font-medium text-gray-900">Blues</div>
                  <div className="text-xs text-gray-500">Rhythm & Soul</div>
                </button>
                
                <button
                  onClick={() => handleGenreSelect('swing')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  <div className="font-medium text-gray-900">Swing</div>
                  <div className="text-xs text-gray-500">Big Band & Dance</div>
                </button>
                
                <button
                  onClick={() => handleGenreSelect('folk')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  <div className="font-medium text-gray-900">Folk</div>
                  <div className="text-xs text-gray-500">Acoustic & Traditional</div>
                </button>
                    </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 곡정보 모달 */}
      {showLyrics && currentTrack && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLyrics(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`bg-white rounded-2xl p-8 w-full mx-4 ${isMobile ? 'max-w-[calc(100vw-2rem)]' : 'max-w-lg'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-2">Track info / Donation</h3>
            </div>

            {/* Album cover and track info - 좌우 배치 */}
            <div className="flex gap-4 mb-6">
              <img
                src={currentTrack.cover}
                alt={currentTrack.album}
                className="w-24 h-24 rounded-lg object-cover shadow-md flex-shrink-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';
                }}
              />
              <div className="flex-1 flex flex-col justify-center">
                <div className="font-medium text-gray-900 mb-1 text-sm">{currentTrack.title}</div>
                <p className="text-xs text-gray-600 mb-2">{currentTrack.artist}</p>
                {currentTrack.genre && (
                  <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full w-fit">
                    {currentTrack.genre}
                  </span>
                )}
              </div>
            </div>

            {/* License & Source Information */}
            <div className="space-y-2 mb-4">
              {currentTrack.license?.includes('creativecommons.org/licenses/by/3.0') && (
                <div>
                  <div className="text-xs font-medium text-gray-900 mb-1">License</div>
                  <a 
                    href="https://creativecommons.org/licenses/by/3.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Creative Commons Attribution 3.0 →
                  </a>
                  <p className="text-xs text-gray-600 mt-1">Commercial use allowed, attribution required</p>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-xs">Source</span>
                <a 
                  href={`https://archive.org/details/${currentTrack.album}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Internet Archive
                </a>
              </div>
            </div>

            {/* Community Board & Donate buttons */}
            <div className="flex flex-col gap-2 mt-4 mb-4">
              <button
                onClick={() => setShowBoard(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-center text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Community Board</span>
              </button>
              <a
                href="https://archive.org/donate"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-center text-sm font-medium transition-colors"
              >
                💝 Donate to Internet Archive
              </a>
              <a
                href="https://buymeacoffee.com/mtfbwy"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full overflow-hidden rounded-lg hover:opacity-80 transition-opacity block"
              >
                <img 
                  src="/images/bymeacoffee.jpg" 
                  alt="Donation to bk."
                  className="w-full h-auto object-contain"
                  onError={(e) => {
                    // 이미지 로드 실패 시 텍스트 버튼으로 폴백
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white', 'py-2', 'px-3', 'text-center', 'text-sm', 'font-medium');
                      parent.innerHTML = '💝 Donation to bk.';
                    }
                  }}
                />
              </a>
            </div>

            {/* Attribution notice */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                {currentTrack.license?.includes('creativecommons.org/licenses/by/3.0') 
                  ? 'Commercial use allowed • Attribution required'
                  : 'Public Domain • Free to use'}
              </p>
            </div>
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
        </>
      )}

      {/* Community Board */}
      <CommunityBoard
        isOpen={showBoard}
        onClose={() => setShowBoard(false)}
      />
      </div> {/* 콘텐츠 레이어 닫기 */}
    </div>
  );
}