import { motion } from 'framer-motion';

interface GenreSelectorProps {
    isMobile: boolean;
    setShowSearch: (show: boolean) => void;
    handleGenreSelect: (genre: string) => Promise<void>;
}

export function GenreSelector({ isMobile, setShowSearch, handleGenreSelect }: GenreSelectorProps) {
    return (
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
    );
}
