import { Search, SkipBack, Pause, Play, SkipForward, Info } from 'lucide-react';
import { Button } from './ui/button';
import { Track } from '@/hooks/useArchiveMusic';

interface PlaybackControlsProps {
    isMobile: boolean;
    currentTrack: Track | undefined;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    isLoading: boolean;
    tracksCount: number;
    showLyrics: boolean;
    handlePlayPause: () => void;
    handlePreviousTrack: () => void;
    handleNextTrack: () => void;
    handleSeek: (time: number) => void;
    setShowSearch: (show: boolean) => void;
    setShowLyrics: (show: boolean) => void;
}

export function PlaybackControls({
    isMobile,
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    isLoading,
    tracksCount,
    showLyrics,
    handlePlayPause,
    handlePreviousTrack,
    handleNextTrack,
    handleSeek,
    setShowSearch,
    setShowLyrics
}: PlaybackControlsProps) {
    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (isMobile) {
        return (
            <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
                {/* 트랙 정보 */}
                <div className="text-center px-4 mt-2">
                    <h2 className="text-gray-900 mb-1 leading-tight" style={{ fontSize: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {currentTrack?.title || 'No Track Selected'}
                    </h2>
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

                {/* 컨트롤 패널 */}
                <div className="grid grid-cols-5 gap-4 items-center w-full max-w-sm mx-auto mb-2 px-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSearch(true)}
                        className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                    >
                        <Search className="w-5 h-5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreviousTrack()}
                        className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                        disabled={tracksCount <= 1}
                    >
                        <SkipBack className="w-5 h-5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePlayPause}
                        className="text-gray-900 hover:text-black w-14 h-14 justify-self-center"
                    >
                        {isPlaying || isLoading ? (
                            <Pause className="w-5 h-5" />
                        ) : (
                            <Play className="w-5 h-5 ml-0.5" />
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleNextTrack()}
                        className="text-gray-600 hover:text-gray-900 w-10 h-10 justify-self-center"
                        disabled={tracksCount <= 1}
                    >
                        <SkipForward className="w-5 h-5" />
                    </Button>

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
        );
    }

    // Desktop layout
    return (
        <div className="space-y-8">
            {/* 트랙 정보 */}
            <div className="text-center xl:text-left">
                <h2 className="text-gray-900 mb-1 leading-tight" style={{ fontSize: '1.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {currentTrack?.title || 'No Track Selected'}
                </h2>
                <p className="text-gray-600 mb-0.5 leading-tight" style={{ fontSize: '1.25rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {currentTrack?.artist || 'Load tracks to start playing'}
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

            {/* 플레이어 컨트롤 */}
            <div className="flex items-center justify-center space-x-4 w-full">
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
                    onClick={() => handlePreviousTrack()}
                    className="text-gray-600 hover:text-gray-900 w-12 h-12"
                    disabled={tracksCount <= 1}
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
                    onClick={() => handleNextTrack()}
                    className="text-gray-600 hover:text-gray-900 w-12 h-12"
                    disabled={tracksCount <= 1}
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
    );
}
