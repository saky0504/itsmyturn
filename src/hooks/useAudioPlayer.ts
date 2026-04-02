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
    isMobile,
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
    const [preloadedTracks, setPreloadedTracks] = useState<Map<string, HTMLAudioElement>>(new Map());
    const [audioBlobCache, setAudioBlobCache] = useState<Map<string, string>>(new Map());

    const audioRef = useRef<HTMLAudioElement>(null);
    const shouldAutoPlayRef = useRef<boolean>(false);
    const playTokenRef = useRef<number>(0);
    const audioWorkerRef = useRef<Worker | null>(null);
    const userPausedRef = useRef<boolean>(false);
    const retryCountRef = useRef<number>(0);
    const audioBlobCacheRef = useRef<Map<string, string>>(new Map());

    const currentTrack = tracks[currentTrackIndex];

    // ==========================================
    // 🚀 Web Worker (Audio Loader)
    // ==========================================
    useEffect(() => {
        try {
            const worker = new Worker(
                new URL('../workers/audio-loader.worker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = (e) => {
                const message = e.data;
                if (message.type === 'WORKER_READY') {
                } else if (message.type === 'AUDIO_LOADED') {
                    const { trackId, blob } = message;
                    const blobUrl = URL.createObjectURL(blob);
                    audioBlobCacheRef.current.set(trackId, blobUrl);
                    setAudioBlobCache(prev => new Map(prev).set(trackId, blobUrl));
                } else if (message.type === 'AUDIO_ERROR') {
                    console.error(`❌ Worker audio error: ${message.trackId}`, message.error);
                }
            };

            worker.onerror = (error) => {
                console.error('❌ Worker error:', error);
            };

            audioWorkerRef.current = worker;

            return () => {
                worker.terminate();
                audioBlobCacheRef.current.forEach(url => URL.revokeObjectURL(url));
                audioBlobCacheRef.current.clear();
            };
        } catch (error) {
            console.warn('⚠️ Worker not supported, falling back to main thread:', error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ==========================================
    // 🎵 Preloading logic
    // ==========================================
    useEffect(() => {
        if (tracks.length > 0 && audioWorkerRef.current) {
            const loadNextTracks = async () => {
                const tracksToPreload = [];
                for (let i = 0; i < Math.min(10, tracks.length); i++) {
                    const trackIndex = (currentTrackIndex + i) % tracks.length;
                    const track = tracks[trackIndex];

                    if (track && !preloadedTracks.has(track.id) && !audioBlobCache.has(track.id)) {
                        tracksToPreload.push({ track, index: i });
                    }
                }


                tracksToPreload.forEach(({ track, index }) => {
                    if (index <= 2) {
                        const audio = new Audio();
                        audio.src = track.preview_url;
                        audio.crossOrigin = 'anonymous';
                        audio.preload = 'auto'; // 전체 로딩
                        setPreloadedTracks(prev => new Map(prev).set(track.id, audio));

                        if (audioWorkerRef.current && isMobile) {
                            audioWorkerRef.current.postMessage({
                                type: 'LOAD_AUDIO',
                                url: track.preview_url,
                                trackId: track.id,
                                useRangeRequest: false,
                                rangeBytes: 204800
                            });
                        }
                    } else if (index <= 5) {
                        const audio = new Audio();
                        audio.src = track.preview_url;
                        audio.crossOrigin = 'anonymous';
                        audio.preload = 'metadata';
                        setPreloadedTracks(prev => new Map(prev).set(track.id, audio));
                    } else {
                        const audio = new Audio();
                        audio.src = track.preview_url;
                        audio.crossOrigin = 'anonymous';
                        audio.preload = 'none';
                        setPreloadedTracks(prev => new Map(prev).set(track.id, audio));
                    }
                });
            };
            loadNextTracks();
        }
    }, [tracks, currentTrackIndex, isMobile, preloadedTracks, audioBlobCache]);

    // ==========================================
    // ⚠️ Playback helpers
    // ==========================================
    const isValidPreviewUrl = (url: string | null | undefined): boolean => {
        if (!url || typeof url !== 'string' || url.trim() === '') return false;
        if (url.startsWith('/')) return true;

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
        return -1;
    };

    const safePlay = async (): Promise<boolean> => {
        if (!audioRef.current) return false;

        const token = ++playTokenRef.current;
        try {
            await audioRef.current.play();
            if (playTokenRef.current !== token) return false;
            return true;
        } catch (error) {
            if (playTokenRef.current !== token) return false;

            const err = error as Error;
            if (err.name === 'AbortError') return false;

            console.warn('🎵 Play failed:', err.name, err.message);
            return false;
        }
    };

    const showVolumeIndicator = (newVolume: number) => {
        toast(`🔊 Volume ${newVolume}%`, {
            duration: 1500,
            position: 'top-center'
        });
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

            if (audio && shouldAutoPlayRef.current && audio.readyState >= 2) {
                audio.play().then(() => {
                    setIsPlaying(true);
                    shouldAutoPlayRef.current = false;
                }).catch(() => {
                    shouldAutoPlayRef.current = false;
                });
            }
        };

        const handleLoadedData = () => {
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
                setDuration(audio.duration);
            }
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

            if (error && error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                const nextIndex = findNextPlayableTrack(currentTrackIndex);
                if (nextIndex !== -1 && nextIndex !== currentTrackIndex) {
                    toast('Switching to available track...', { duration: 2000 });
                    setTimeout(() => setCurrentTrackIndex(nextIndex), 500);
                    return;
                }
            }
            toast.error('Audio playback failed');
        };

        const handlePlay = () => {
            setIsPlaying(true);
            setIsLoading(false);
            userPausedRef.current = false;

            if (audio) {
                const cTime = audio.currentTime || 0;
                setCurrentTime(cTime);
                if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                    setDuration(audio.duration);
                }

                setTimeout(() => { if (audio && !audio.paused) setCurrentTime(audio.currentTime || 0); }, 100);
                setTimeout(() => { if (audio && !audio.paused) setCurrentTime(audio.currentTime || 0); }, 200);
                setTimeout(() => { if (audio && !audio.paused) setCurrentTime(audio.currentTime || 0); }, 300);
            }

            setTimeout(() => {
                preloadedTracks.forEach((pa) => {
                    if (pa.preload !== 'auto') {
                        pa.preload = 'auto';
                    }
                });
            }, 1000);
        };

        const handlePause = () => {
            setIsPlaying(false);

            if (!userPausedRef.current && audio && !audio.ended) {
                setTimeout(() => {
                    if (audio && !userPausedRef.current && audio.paused && !audio.ended) {
                        audio.play().catch(err => console.error('❌ Auto-retry failed:', err));
                    }
                }, 500);
            }
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

        let rafId: number;
        const tick = () => {
            if (audio) {
                setCurrentTime(audio.currentTime || 0);
                if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
                    setDuration(audio.duration);
                }
            } else {
                setCurrentTime(0);
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

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

            cancelAnimationFrame(rafId);
        };
    }, [currentTrackIndex, isPlaying, preloadedTracks, requestReview]);

    useEffect(() => {
        setCurrentTime(0);
        const forceTimelineCheck = setTimeout(() => {
            if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime || 0);
                if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
                    setDuration(audioRef.current.duration);
                }
            }
        }, 500);
        return () => clearTimeout(forceTimelineCheck);
    }, []);

    useEffect(() => {
        if (audioRef.current && !isNaN(volume)) {
            try {
                audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
            } catch (error) {
                console.warn('Volume update failed:', error);
            }
        }
    }, [volume]);

    // ==========================================
    // 🔄 Track Change Logic
    // ==========================================
    useEffect(() => {
        if (!currentTrack) return;

        const setupNewTrack = async () => {
            const MAX_RETRIES = 2;
            let retryCount = 0;

            while (retryCount <= MAX_RETRIES) {
                try {
                    setIsLoading(true);
                    setCurrentTime(0);
                    const trackDuration = currentTrack.duration ? currentTrack.duration / 1000 : 0;
                    setDuration(trackDuration);

                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                        audioRef.current.src = '';
                        audioRef.current.load();
                        playTokenRef.current++;

                        const blobUrl = audioBlobCache.get(currentTrack.id);
                        const preloadedAudio = preloadedTracks.get(currentTrack.id);

                        if (blobUrl) {
                            audioRef.current.src = blobUrl;
                            audioRef.current.currentTime = 0;
                        } else if (preloadedAudio) {
                            audioRef.current.src = preloadedAudio.src;
                            audioRef.current.currentTime = 0;
                        } else if (isValidPreviewUrl(currentTrack.preview_url)) {
                            audioRef.current.src = currentTrack.preview_url;
                            audioRef.current.load();
                        } else {
                            audioRef.current.removeAttribute('src');
                            audioRef.current.load();
                        }
                    }

                    setIsAudioReady(false);
                    const shouldAutoPlay = shouldAutoPlayRef.current;
                    if (shouldAutoPlayRef.current) shouldAutoPlayRef.current = false;

                    if (shouldAutoPlay && audioRef.current && isValidPreviewUrl(currentTrack.preview_url)) {
                        const preloadedAudio = preloadedTracks.get(currentTrack.id);

                        const waitForLoad = new Promise<void>((resolve, reject) => {
                            if (!audioRef.current) return resolve();
                            if (preloadedAudio) {
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
                                    audioRef.current.muted = true;
                                    await audioRef.current.play();
                                    setIsPlaying(true);

                                    if (!isNaN(audioRef.current.currentTime)) {
                                        setCurrentTime(audioRef.current.currentTime);
                                    }

                                    setTimeout(() => {
                                        if (audioRef.current) {
                                            audioRef.current.muted = false;
                                            audioRef.current.volume = Math.max(0, Math.min(1, (volume || 75) / 100));
                                        }
                                    }, 100);

                                    retryCountRef.current = 0;
                                    return;
                                } catch (playError: unknown) {
                                    const err = playError as Error;
                                    if (err.name === 'AbortError') return;

                                    if (retryCountRef.current < 3) {
                                        retryCountRef.current++;
                                        if (audioRef.current) audioRef.current.muted = false;
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                        continue;
                                    } else {
                                        retryCountRef.current = 0;
                                        setIsPlaying(false);
                                        if (audioRef.current) audioRef.current.muted = false;
                                        return;
                                    }
                                }
                            }
                        } catch (error: unknown) {
                            const err = error as Error;
                            if (err.message !== 'Audio loading timeout') {
                                console.error('❌ Auto-play error:', err);
                            }
                            setIsPlaying(false);
                            return;
                        }
                    }
                    return;
                } catch (error: unknown) {
                    retryCount++;
                    const err = error as Error;
                    const isNetworkError = err.message.includes('ERR_CONNECTION_RESET') ||
                        err.message.includes('ERR_NETWORK_CHANGED') ||
                        err.message.includes('ERR_INTERNET_DISCONNECTED') ||
                        err.message.includes('Failed to fetch') ||
                        err.message.includes('Audio loading failed');

                    if (retryCount <= MAX_RETRIES && isNetworkError) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    } else {
                        setIsPlaying(false);
                        break;
                    }
                } finally {
                    if (retryCount > MAX_RETRIES) {
                        setIsLoading(false);
                    }
                }
            }
        };

        setupNewTrack();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrack]);

    // 키보드 볼륨 조절
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

    // 트랙 변경 시 진행상황 강제 초기화
    useEffect(() => {
        setCurrentTime(0);
        const trackDuration = tracks[currentTrackIndex]?.duration ? tracks[currentTrackIndex].duration / 1000 : 0;
        setDuration(trackDuration);
        setIsPlaying(false);

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.pause();
        }
    }, [currentTrackIndex, tracks]);

    // 에러 토스트 표시
    useEffect(() => {
        if (!currentTrack && tracks.length === 0 && !tracksLoading) {
            const timerId = setTimeout(() => {
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
            return () => clearTimeout(timerId);
        }
    }, [currentTrack, tracks.length, tracksLoading]);


    // ==========================================
    // 🎮 Playback Controllers (Public API)
    // ==========================================
    const handleNextTrack = useCallback((autoContinue: boolean = false) => {
        if (tracks.length === 0) return;
        hapticHeavy();

        const wasPlaying = autoContinue ? true : isPlaying;
        shouldAutoPlayRef.current = wasPlaying;
        setIsPlaying(false);

        const nextIndex = findNextPlayableTrack(currentTrackIndex, 'next');
        if (nextIndex !== -1) {
            setCurrentTrackIndex(nextIndex);
        } else {
            setCurrentTrackIndex((prev) => prev === tracks.length - 1 ? 0 : prev + 1);
        }
    }, [currentTrackIndex, tracks.length, isPlaying, hapticHeavy]);

    const handlePreviousTrack = useCallback((autoContinue: boolean = false) => {
        if (tracks.length === 0) return;
        hapticHeavy();

        const wasPlaying = autoContinue ? true : isPlaying;
        shouldAutoPlayRef.current = wasPlaying;
        setIsPlaying(false);

        const nextIndex = findNextPlayableTrack(currentTrackIndex, 'prev');
        if (nextIndex !== -1) {
            setCurrentTrackIndex(nextIndex);
        } else {
            setCurrentTrackIndex((prev) => prev === 0 ? tracks.length - 1 : prev - 1);
        }
    }, [currentTrackIndex, tracks.length, isPlaying, hapticHeavy]);

    const handlePlayPause = useCallback(async () => {
        if (!audioRef.current) return;

        if (!currentTrack || tracks.length === 0) {
            toast.error('No tracks available. Please load some tracks first.');
            return;
        }

        if (!isValidPreviewUrl(currentTrack?.preview_url)) {
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
            const isAudioPlaying = audioRef.current && !audioRef.current.paused;

            if (isPlaying || isLoading || isAudioPlaying) {
                userPausedRef.current = true;
                shouldAutoPlayRef.current = false;
                await hapticMedium();

                if (audioRef.current) {
                    audioRef.current.pause();
                }
                if (isLoading) {
                    setIsLoading(false);
                }
            } else {
                if (!currentTrack) {
                    toast.error('No tracks available. Please load some tracks first.');
                    return;
                }

                userPausedRef.current = false;
                setIsLoading(true);
                audioRef.current.volume = volume / 100;

                if (audioRef.current && audioRef.current.preload !== 'auto') {
                    audioRef.current.preload = 'auto';
                }

                if (!isAudioReady) {
                    toast('Loading track...', { duration: 1500 });

                    const waitForReady = new Promise<boolean>((resolve) => {
                        const timeout = setTimeout(() => resolve(false), 3000);
                        const checkReady = setInterval(() => {
                            if (isAudioReady || (audioRef.current && audioRef.current.readyState >= 2)) {
                                clearTimeout(timeout);
                                clearInterval(checkReady);
                                resolve(true);
                            }
                        }, 50);
                    });

                    const ready = await waitForReady;
                    if (!ready) {
                        toast.error('Track loading timeout. Please try again.');
                        setIsLoading(false);
                        return;
                    }
                }

                const MAX_RETRIES = 2;
                let retryCount = 0;
                let playSuccess = false;

                while (retryCount <= MAX_RETRIES && !playSuccess) {
                    try {
                        playSuccess = await safePlay();

                        if (playSuccess) {
                            await hapticMedium();

                            if (audioRef.current) {
                                const cTime = audioRef.current.currentTime || 0;
                                setCurrentTime(cTime);
                                if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                                    setDuration(audioRef.current.duration);
                                }

                                for (let i = 1; i <= 5; i++) {
                                    setTimeout(() => {
                                        if (audioRef.current && !audioRef.current.paused) {
                                            setCurrentTime(audioRef.current.currentTime || 0);
                                        }
                                    }, i * 100);
                                }
                            }
                            break;
                        } else {
                            break;
                        }
                    } catch (playError: unknown) {
                        retryCount++;
                        const err = playError as Error;
                        const isNetworkError = err.message.includes('ERR_CONNECTION_RESET') ||
                            err.message.includes('ERR_NETWORK_CHANGED') ||
                            err.message.includes('ERR_INTERNET_DISCONNECTED') ||
                            err.message.includes('Failed to fetch');

                        if (retryCount <= MAX_RETRIES && isNetworkError) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                        } else {
                            throw err;
                        }
                    }
                }

                if (!playSuccess) {
                    setIsLoading(false);
                    setIsPlaying(false);
                }
            }
        } catch (error: unknown) {
            const err = error as Error;
            setIsLoading(false);
            setIsPlaying(false);

            if (err.name === 'NotAllowedError') {
                toast.error('Click to allow audio playback');
            } else if (err.message === 'Load timeout' || err.message === 'Audio loading timeout') {
                toast.error('Track loading timeout - trying next track');
                const nextIndex = findNextPlayableTrack(currentTrackIndex);
                if (nextIndex !== -1) {
                    setCurrentTrackIndex(nextIndex);
                } else {
                    toast.error('No more tracks available');
                }
            } else if (err.name === 'AbortError') {
                // Ignore abort errors
            } else if (err.name === 'NotSupportedError') {
                toast.error('Audio format not supported');
                const nextIndex = findNextPlayableTrack(currentTrackIndex);
                if (nextIndex !== -1) {
                    setCurrentTrackIndex(nextIndex);
                }
            } else {
                toast.error('Playback failed');
            }
        }
    }, [currentTrack, tracks.length, currentTrackIndex, isPlaying, isLoading, isAudioReady, volume, hapticMedium]);

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
