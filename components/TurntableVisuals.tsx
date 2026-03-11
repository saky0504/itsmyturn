import { useEffect, useRef } from 'react';
import { motion, useAnimationControls, PanInfo } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import { Track } from '@/hooks/useArchiveMusic';

interface TurntableVisualsProps {
    isMobile: boolean;
    currentTrack: Track | undefined;
    isLoading: boolean;
    isPlaying: boolean;
    isInitialLoading: boolean;
    handlePlayPause: () => void;
    handleDragEnd: (event: unknown, info: PanInfo) => void;
    getOptimizedCoverUrl: (url: string) => string;
}

export function TurntableVisuals({
    isMobile,
    currentTrack,
    isLoading,
    isPlaying,
    isInitialLoading,
    handlePlayPause,
    handleDragEnd,
    getOptimizedCoverUrl
}: TurntableVisualsProps) {
    const spinControls = useAnimationControls();
    const containerRef = useRef<HTMLDivElement>(null);

    // LP 회전 애니메이션 컨트롤러
    useEffect(() => {
        try {
            const shouldRotate = isPlaying || isLoading;

            if (shouldRotate) {
                spinControls.start({
                    rotate: [0, 360],
                    transition: {
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear"
                    }
                });
            } else if (spinControls) {
                spinControls.stop();
            }
        } catch (error) {
            console.warn('LP animation control error:', error);
        }
    }, [isPlaying, isLoading, isInitialLoading, spinControls, currentTrack]);

    const defaultCoverSVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjcwIiBmaWxsPSIjRkZGNzAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iNCIvPgo8Y2lyY2xlIGN4PSI4NSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxjaXJjbGUgY3g9IjExNSIgY3k9IjkwIiByPSI4IiBmaWxsPSIjMDAwIi8+CjxwYXRoIGQ9Ik0xMDAgMTIwIEwxMDAgMTEwIEw5MCAxMTUgTDEwMCAxMjBaIiBmaWxsPSIjRkY2NjAwIi8+CjxwYXRoIGQ9Ik05MCAxNjAgUTEwMCAxNTUgMTEwIDE2MCBMOTAgMTYwWiIgZmlsbD0iIzAwMCIvPgo8L3N2Zz4K';

    // Mobile layout
    if (isMobile) {
        return (
            <div className="relative h-[55vh] overflow-hidden flex items-center justify-center">
                {/* 턴테이블 베이스 */}
                <div className="relative mt-4" ref={containerRef}>
                    <motion.div
                        className="relative cursor-pointer w-[85vw] h-[85vw] max-w-[360px] max-h-[360px]"
                        onClick={handlePlayPause}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        onDragEnd={handleDragEnd}
                        dragElastic={0.1}
                        onTouchStart={(e) => {
                            e.stopPropagation();
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
                                src={getOptimizedCoverUrl(currentTrack?.cover || '') || defaultCoverSVG}
                                alt={`${currentTrack?.album || 'Music Loading'} cover`}
                                className="w-full h-full object-contain"
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    console.log('🦆 Image failed, using fallback');
                                    target.src = defaultCoverSVG;
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
                                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor" />
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
        );
    }

    // Desktop layout
    return (
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
                        src={getOptimizedCoverUrl(currentTrack?.cover || '') || defaultCoverSVG}
                        alt={`${currentTrack?.album || 'Music Loading'} cover`}
                        className="w-full h-full object-contain"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            console.log('🦆 Image failed, using fallback');
                            target.src = defaultCoverSVG;
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
                                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor" />
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
    );
}
