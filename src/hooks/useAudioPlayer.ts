import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Track } from './useArchiveMusic';

interface UseAudioPlayerProps {
    tracks: Track[];
    tracksLoading: boolean;
    isInitialLoading: boolean;
    isMobile: boolean;
    hapticMedium: () => Promise<void>;
    hapticHeavy: () => Promise<void>;
    requestReview: () => Promise<void>;
}

export function useAudioPlayer({
    tracks,
    tracksLoading,
    hapticMedium,
    hapticHeavy,
    requestReview
}: UseAudioPlayerProps) {
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(75);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isAudioReady, setIsAudioReady] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const preloadedAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());

    const currentTrack = tracks[currentTrackIndex];

    const showVolumeIndicator = (newVolume: number) => {
        toast(`🔊 Volume ${newVolume}%`, { duration: 1500, position: 'top-center' });
    };

    // ==========================================
    // 🎵 Native Preloading
    // ==========================================
    useEffect(() => {
        if (tracks.length > 0) {
            const tempMap = new Map<string, HTMLAudioElement>();
            
            // Only preload the immediate next tracks natively (metadata only)
            for (let i = 1; i <= 2; i++) {
                const nextIndex = (currentTrackIndex + i) % tracks.length;
                const nextTrack = tracks[nextIndex];
                
                if (nextTrack && nextTrack.preview_url) {
                    const audio = new Audio();
                    audio.src = nextTrack.preview_url;
                    audio.crossOrigin = 'anonymous';
                    audio.preload = 'metadata';
                    tempMap.set(nextTrack.id, audio);
                }
            }
            preloadedAudioRef.current = tempMap;
        }
    }, [tracks, currentTrackIndex]);

    // ==========================================
    // ⚠️ Playback helpers
    // ==========================================
    const isValidPreviewUrl = (url: string | null | undefined): boolean => {
        if (!url || typeof url !== 'string' || url.trim() === '') return false;
        if (url.startsWith('/')) return true;
        try {
            const urlObj = new URL(url);
            return urlObj.protocol.startsWith('http');
        } catch {
            return false;
        }
    };

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
            if (isValidPreviewUrl(tracks[index]?.preview_url)) return index;
            attempts++;
        }
        return -1;
    };

    // ==========================================
    // 🎧 Audio Event Listeners
    // ==========================================
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            if (!isNaN(time) && isFinite(time)) {
                setCurrentTime(time);
                if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
                    setDuration(audio.duration);
                }
            }
        };

        const updateDuration = () => {
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
                setDuration(audio.duration);
            }
        };

        const handleLoadStart = () => {
            setIsLoading(true);
            setIsAudioReady(false);
        };

        const handleCanPlay = () => {
            setIsLoading(false);
            setIsAudioReady(true);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            handleNextTrack(true);
            requestReview();
        };

        const handleError = (e: Event) => {
            const audioTarget = e.target as HTMLAudioElement;
            const error = audioTarget.error;
            setIsLoading(false);
            setIsPlaying(false);

            console.error("Audio Playback Error:", error);

            if (error && error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                const nextIndex = findNextPlayableTrack(currentTrackIndex);
                if (nextIndex !== -1 && nextIndex !== currentTrackIndex) {
                    toast('Switching to available track...', { duration: 2000 });
                    setTimeout(() => setCurrentTrackIndex(nextIndex), 500);
                    return;
                }
            }
        };

        const handlePlay = () => {
            setIsPlaying(true);
            setIsLoading(false);
        };

        const handlePause = () => {
            setIsPlaying(false);
        };

        const handleLoadedData = () => {
             updateDuration();
             setIsAudioReady(true);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('loadeddata', handleLoadedData);
        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        let mainTimer = setInterval(() => {
            if (audio) {
                setCurrentTime(audio.currentTime || 0);
            }
        }, 100);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('loadeddata', handleLoadedData);
            audio.removeEventListener('loadstart', handleLoadStart);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            clearInterval(mainTimer);
        };
    }, [currentTrackIndex, tracks.length]);

    // Volume control
    useEffect(() => {
        if (audioRef.current && !isNaN(volume)) {
            try {
                audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
            } catch (error) {
                console.warn('Volume update failed:', error);
            }
        }
    }, [volume]);

    // Keyboard volume control
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
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

    // ==========================================
    // 🔄 Track Change Logic
    // ==========================================
    useEffect(() => {
        if (!currentTrack || !audioRef.current) return;

        setIsLoading(true);
        setCurrentTime(0);
        setDuration(currentTrack.duration ? currentTrack.duration / 1000 : 0);
        setIsAudioReady(false);
        
        // Always cleanly assign the real, native URL (no caching bloat).
        const urlToPlay = currentTrack.preview_url || '';
        
        if (audioRef.current.src !== urlToPlay) {
            audioRef.current.pause();
            audioRef.current.src = urlToPlay;
            audioRef.current.load();
        }
    }, [currentTrack]);

    useEffect(() => {
        if (!currentTrack && tracks.length === 0 && !tracksLoading) {
            const timerId = setTimeout(() => {
                toast.error('Failed to load music', { duration: 6000 });
            }, 100);
            return () => clearTimeout(timerId);
        }
    }, [currentTrack, tracks.length, tracksLoading]);

    // ==========================================
    // 🎮 Playback Controllers (Public API)
    // ==========================================
    const playNative = async () => {
        if (!audioRef.current) return;
        try {
            await audioRef.current.play();
            setIsPlaying(true);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Play Native Failed:', error);
                setIsPlaying(false);
                setIsLoading(false);
                toast.error('Playback failed. Trying another track.', { position: 'bottom-center' });
                const nextIndex = findNextPlayableTrack(currentTrackIndex, 'next');
                if (nextIndex !== -1 && nextIndex !== currentTrackIndex) {
                    setCurrentTrackIndex(nextIndex);
                    setTimeout(() => { if(audioRef.current) { audioRef.current.src = tracks[nextIndex].preview_url || ''; audioRef.current.play().catch(()=>{}); } }, 100);
                }
            }
        }
    }

    const handleNextTrack = useCallback((autoContinue: boolean = false) => {
        if (tracks.length === 0) return;
        hapticHeavy();

        const wasPlaying = autoContinue ? true : isPlaying;
        const nextIndex = findNextPlayableTrack(currentTrackIndex, 'next');
        const finalNextIndex = nextIndex !== -1 ? nextIndex : ((currentTrackIndex + 1) % tracks.length);
        
        setCurrentTrackIndex(finalNextIndex);
        
        if (wasPlaying) {
             if (audioRef.current && tracks[finalNextIndex]?.preview_url) {
                  audioRef.current.src = tracks[finalNextIndex].preview_url;
                  playNative();
             }
        }
    }, [currentTrackIndex, tracks, isPlaying, hapticHeavy]);

    const handlePreviousTrack = useCallback((autoContinue: boolean = false) => {
        if (tracks.length === 0) return;
        hapticHeavy();

        const wasPlaying = autoContinue ? true : isPlaying;
        const nextIndex = findNextPlayableTrack(currentTrackIndex, 'prev');
        const finalNextIndex = nextIndex !== -1 ? nextIndex : (currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1);
        
        setCurrentTrackIndex(finalNextIndex);
        
        if (wasPlaying) {
             if (audioRef.current && tracks[finalNextIndex]?.preview_url) {
                  audioRef.current.src = tracks[finalNextIndex].preview_url;
                  playNative();
             }
        }
    }, [currentTrackIndex, tracks, isPlaying, hapticHeavy]);

    const handlePlayPause = useCallback(async () => {
        if (!audioRef.current) return;

        if (!currentTrack || tracks.length === 0) {
            toast.error('No tracks available.');
            return;
        }

        if (!isValidPreviewUrl(currentTrack?.preview_url)) {
            toast.error('Invalid track URL.');
            handleNextTrack();
            return;
        }

        if (isPlaying || (audioRef.current && !audioRef.current.paused)) {
            await hapticMedium();
            audioRef.current.pause();
            setIsPlaying(false);
            setIsLoading(false);
        } else {
            setIsLoading(true);
            await hapticMedium();
            
            audioRef.current.volume = volume / 100;
            
            // Synchronously set src to capture user gesture
            if (audioRef.current.src !== currentTrack.preview_url && currentTrack.preview_url) {
                audioRef.current.src = currentTrack.preview_url;
            }
            
            playNative();
        }
    }, [currentTrack, tracks.length, isPlaying, volume, hapticMedium, currentTrackIndex]);

    const handleSeek = (newTime: number) => {
        if (!audioRef.current || !duration) return;
        setCurrentTime(newTime);
        audioRef.current.currentTime = newTime;
    };

    return {
        audioRef,
        currentTrack,
        currentTrackIndex,
        setCurrentTrackIndex,
        isPlaying,
        isLoading,
        isAudioReady,
        volume,
        setVolume,
        currentTime,
        duration,
        handlePlayPause,
        handleNextTrack,
        handlePreviousTrack,
        handleSeek
    };
}
