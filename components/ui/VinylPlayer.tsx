import React, { useState, useEffect } from 'react'

interface VinylPlayerProps {
  track?: {
    name: string
    artist: string
    image: string
  }
  isPlaying: boolean
  onTogglePlay: () => void
}

const VinylPlayer: React.FC<VinylPlayerProps> = ({
  track,
  isPlaying,
  onTogglePlay
}) => {
  const [isSpinning, setIsSpinning] = useState(false)

  useEffect(() => {
    setIsSpinning(isPlaying)
  }, [isPlaying])

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Vinyl Record */}
      <div className="relative">
        <div 
          className={`w-48 h-48 bg-gradient-to-br from-gray-800 to-black rounded-full shadow-2xl transition-transform duration-1000 ${
            isSpinning ? 'animate-spin' : ''
          }`}
        >
          {/* Vinyl grooves */}
          <div className="absolute inset-2 border-2 border-gray-600 rounded-full"></div>
          <div className="absolute inset-6 border-2 border-gray-600 rounded-full"></div>
          <div className="absolute inset-10 border-2 border-gray-600 rounded-full"></div>
          
          {/* Center label */}
          <div className="absolute top-1/2 left-1/2 w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="w-6 h-6 bg-black rounded-full"></div>
          </div>

          {/* Album art overlay */}
          {track && (
            <div className="absolute inset-8 rounded-full overflow-hidden">
              <img
                src={track.image}
                alt={track.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Needle */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
          <div className={`w-1 h-16 bg-gray-600 transform origin-bottom transition-transform duration-500 ${
            isSpinning ? 'rotate-12' : 'rotate-0'
          }`}></div>
        </div>
      </div>

      {/* Track Info */}
      {track && (
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">{track.name}</h3>
          <p className="text-gray-400">{track.artist}</p>
        </div>
      )}

      {/* Play Button */}
      <button
        onClick={onTogglePlay}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
          isPlaying 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-green-500 hover:bg-green-600'
        } text-white shadow-lg hover:shadow-xl`}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
        ) : (
          <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
          </svg>
        )}
      </button>
    </div>
  )
}

export default VinylPlayer
