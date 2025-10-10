import React, { useState, useEffect } from 'react'

interface SpotifyVinylPlayerProps {
  track: {
    name: string
    artist: string
    album: string
    image: string
    duration: number
    preview_url?: string
  }
  isPlaying: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
}

const SpotifyVinylPlayer: React.FC<SpotifyVinylPlayerProps> = ({
  track,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious
}) => {
  const [progress, setProgress] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)

  useEffect(() => {
    setIsSpinning(isPlaying)
  }, [isPlaying])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => (prev + 1) % 100)
      }, 100)
    }
    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
      {/* Vinyl Record */}
      <div className="flex justify-center mb-6">
        <div className={`relative w-64 h-64 transition-transform duration-1000 ${isSpinning ? 'animate-spin' : ''}`}>
          {/* Vinyl */}
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-full shadow-inner">
            <div className="absolute inset-4 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full">
              <div className="absolute inset-4 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full">
                <div className="absolute inset-4 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full">
                  {/* Center hole */}
                  <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-black rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Album Art */}
          <div className="absolute inset-8">
            <img
              src={track.image}
              alt={track.album}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Track Info */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-1">{track.name}</h3>
        <p className="text-gray-400 mb-1">{track.artist}</p>
        <p className="text-gray-500 text-sm">{track.album}</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center space-x-6">
        <button
          onClick={onPrevious}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"/>
          </svg>
        </button>

        <button
          onClick={onTogglePlay}
          className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 transition-colors"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
            </svg>
          )}
        </button>

        <button
          onClick={onNext}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default SpotifyVinylPlayer
