import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Music, ShoppingBag } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from './ui/use-mobile';
import { useNativeFeatures } from '../src/hooks/useNativeFeatures';
import { useArchiveMusic } from '../src/hooks/useArchiveMusic';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';

import { TurntableVisuals } from './TurntableVisuals';
import { PlaybackControls } from './PlaybackControls';
import { GenreSelector } from './GenreSelector';
import { TrackInfoModal } from './TrackInfoModal';
import { CommunityBoard } from './CommunityBoard';

export function VinylPlayer() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showSearch, setShowSearch] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  const {
    openInAppBrowser,
    hapticMedium,
    hapticHeavy,
    requestReview
  } = useNativeFeatures();

  const {
    tracks,
    isInitialLoading: tracksLoading,
    loadTracksByGenre,
    loadRecommendations
  } = useArchiveMusic();

  const {
    audioRef,
    currentTrack,
    isPlaying,
    isLoading: isAudioLoading,
    currentTime,
    duration,
    handlePlayPause,
    handleNextTrack,
    handlePreviousTrack,
    handleSeek
  } = useAudioPlayer({
    tracks,
    tracksLoading,
    isInitialLoading: tracksLoading,
    isMobile,
    hapticMedium,
    hapticHeavy,
    requestReview
  });

  // 오디오 모드 설정 (iOS 무음 모드 무시)
  useEffect(() => {
    // Web only - no setup needed
     
  }, []);

  // 초기 추천 트랙 로딩
  useEffect(() => {
    loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenMarket = () => {
    hapticMedium();
    navigate('/market');
  };

  const getOptimizedCoverUrl = (url: string | undefined): string => {
    if (!url) return '';
    if (url.includes('archive.org/services/img/')) {
      if (url.includes('?')) return url;
      return `${url}?width=400`;
    }
    return url;
  };

  const handleDragEnd = (_event: unknown, info: { offset: { x: number } }) => {
    const swipeThreshold = isMobile ? 30 : 50;
    if (info.offset.x > swipeThreshold) {
      handleNextTrack();
    } else if (info.offset.x < -swipeThreshold) {
      handlePreviousTrack();
    }
  };

  const handleGenreSelect = async (genre: string) => {
    setShowSearch(false);
    await loadTracksByGenre(genre);
    const genreNames: { [key: string]: string } = {
      'all': 'All Genres', 'jazz': 'Jazz', 'classical': 'Classical',
      'blues': 'Blues', 'swing': 'Swing', 'folk': 'Folk'
    };
    toast.success(`Loading ${genreNames[genre]} tracks...`);
  };

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden relative ${isMobile ? 'pt-0' : 'p-8 justify-center items-center'}`}>
      {/* 배경 레이어 */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-100 z-0" />

      {/* 콘텐츠 레이어 */}
      <div className={`relative z-10 w-full flex flex-col ${isMobile ? 'h-full' : ''}`}>

        {/* Show loading state while tracks are being loaded */}
        {tracksLoading && (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 relative z-50">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Music className="w-6 h-6 text-gray-800 animate-pulse" />
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
            {isMobile ? (
              <div className="relative w-full flex-1 flex flex-col justify-center">
                <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-3">
                  <button onClick={handleOpenMarket} className="group" aria-label="Open LP Market comparison">
                    <div className="relative w-10 h-10 bg-white/80 rounded-full shadow-lg backdrop-blur-sm flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-gray-900" />
                    </div>
                  </button>
                </div>

                <TurntableVisuals
                  isMobile={isMobile}
                  currentTrack={currentTrack}
                  isLoading={isAudioLoading}
                  isPlaying={isPlaying}
                  isInitialLoading={tracksLoading}
                  handlePlayPause={handlePlayPause}
                  handleDragEnd={handleDragEnd}
                  getOptimizedCoverUrl={getOptimizedCoverUrl}
                />

                <PlaybackControls
                  isMobile={isMobile}
                  currentTrack={currentTrack}
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  isLoading={isAudioLoading}
                  tracksCount={tracks.length}
                  showLyrics={showLyrics}
                  handlePlayPause={handlePlayPause}
                  handlePreviousTrack={handlePreviousTrack}
                  handleNextTrack={handleNextTrack}
                  handleSeek={handleSeek}
                  setShowSearch={setShowSearch}
                  setShowLyrics={setShowLyrics}
                />
              </div>
            ) : (
              <div className="max-w-4xl xl:max-w-6xl mx-auto relative w-full pt-10">
                <div className="absolute top-[85px] -right-[15px] z-50 flex items-center gap-3">
                  <button onClick={handleOpenMarket} className="group" aria-label="Open LP Market comparison">
                    <div className="relative w-12 h-12 bg-white rounded-full bg-opacity-25 hover:bg-opacity-40 transition-opacity flex items-center justify-center shadow-lg">
                      <ShoppingBag className="w-5 h-5 text-black group-hover:text-gray-800" />
                    </div>
                  </button>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 xl:gap-[104px] items-center">
                  <TurntableVisuals
                    isMobile={isMobile}
                    currentTrack={currentTrack}
                    isLoading={isAudioLoading}
                    isPlaying={isPlaying}
                    isInitialLoading={tracksLoading}
                    handlePlayPause={handlePlayPause}
                    handleDragEnd={handleDragEnd}
                    getOptimizedCoverUrl={getOptimizedCoverUrl}
                  />

                  <PlaybackControls
                    isMobile={isMobile}
                    currentTrack={currentTrack}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    isLoading={isAudioLoading}
                    tracksCount={tracks.length}
                    showLyrics={showLyrics}
                    handlePlayPause={handlePlayPause}
                    handlePreviousTrack={handlePreviousTrack}
                    handleNextTrack={handleNextTrack}
                    handleSeek={handleSeek}
                    setShowSearch={setShowSearch}
                    setShowLyrics={setShowLyrics}
                  />
                </div>
              </div>
            )}

            {/* Modals and Overlays */}
            {showSearch && (
              <GenreSelector
                isMobile={isMobile}
                setShowSearch={setShowSearch}
                handleGenreSelect={handleGenreSelect}
              />
            )}

            {showLyrics && currentTrack && (
              <TrackInfoModal
                isMobile={isMobile}
                currentTrack={currentTrack}
                setShowLyrics={setShowLyrics}
                setShowBoard={setShowBoard}
                getOptimizedCoverUrl={getOptimizedCoverUrl}
                openInAppBrowser={openInAppBrowser}
              />
            )}

            {/* Hidden audio element — key 제거: useEffect에서 src를 관리하므로 React의 DOM 재생성 방지 */}
            <audio
              ref={audioRef}
              preload="metadata"
              crossOrigin="anonymous"
            />
          </>
        )}

        {/* Community Board */}
        {showBoard && (
          <CommunityBoard
            isOpen={showBoard}
            onClose={() => setShowBoard(false)}
          />
        )}
      </div>
    </div>
  );
}