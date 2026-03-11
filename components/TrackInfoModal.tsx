import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { Track } from '@/hooks/useArchiveMusic';

interface TrackInfoModalProps {
    isMobile: boolean;
    currentTrack: Track;
    setShowLyrics: (show: boolean) => void;
    setShowBoard: (show: boolean) => void;
    getOptimizedCoverUrl: (url: string) => string;
    openInAppBrowser: (url: string) => void;
}

export function TrackInfoModal({
    isMobile,
    currentTrack,
    setShowLyrics,
    setShowBoard,
    getOptimizedCoverUrl,
    openInAppBrowser
}: TrackInfoModalProps) {
    return (
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
                        src={getOptimizedCoverUrl(currentTrack.cover)}
                        alt={currentTrack.album}
                        className="w-24 h-24 rounded-lg object-cover shadow-md flex-shrink-0"
                        loading="lazy"
                        decoding="async"
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
                        onClick={() => {
                            setShowLyrics(false);
                            setShowBoard(true);
                        }}
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

                {/* Legal links and copyright */}
                <div className="pt-3 border-t border-gray-200 space-y-1.5">
                    <div className="flex items-center justify-center gap-1.5 text-xs flex-wrap">
                        <button
                            onClick={() => {
                                const url = window.location.origin + '/privacy-policy.html';
                                openInAppBrowser(url);
                            }}
                            className="text-gray-500 hover:text-gray-700 underline transition-colors bg-transparent border-none cursor-pointer p-0 font-[inherit] text-xs"
                        >
                            Privacy Policy
                        </button>
                        <span className="text-gray-400">•</span>
                        <button
                            onClick={() => {
                                const url = window.location.origin + '/terms-of-service.html';
                                openInAppBrowser(url);
                            }}
                            className="text-gray-500 hover:text-gray-700 underline transition-colors bg-transparent border-none cursor-pointer p-0 font-[inherit] text-xs"
                        >
                            Terms of Service
                        </button>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">
                            {currentTrack.license?.includes('creativecommons.org/licenses/by/3.0')
                                ? 'Commercial use allowed • Attribution required'
                                : 'Public Domain • Free to use'}
                        </span>
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                        © 2025 It's My Turn • All rights reserved
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}
