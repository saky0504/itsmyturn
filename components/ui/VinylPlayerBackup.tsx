import React, { useState } from 'react'

interface VinylPlayerBackupProps {
  track?: {
    name: string
    artist: string
    image: string
    duration: number
  }
  isPlaying: boolean
  onTogglePlay: () => void
  onSeek?: (position: number) => void
}

const VinylPlayerBackup: React.FC<VinylPlayerBackupProps> = ({
  track,
  isPlaying,
  onTogglePlay,
  onSeek
}) => {
  const [progress, setProgress] = useState(0)

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = (clickX / rect.width) * 100
    setProgress(percentage)
    onSeek?.(percentage)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 w-full max-w-md">
      {/* Vinyl Record */}
      <div className="flex justify-center mb-4">
        <div className={`relative w-32 h-32 transition-transform duration-1000 ${isPlaying ? 'animate-spin' : ''}`}>
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 rounded-full shadow-inner">
            <div className="absolute inset-2 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full">
              <div className="absolute inset-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full">
                {/* Center hole */}
                <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-black rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
              </div>
            </div>
          </div>
          
          {/* Album Art */}
          {track && (
            <div className="absolute inset-3">
              <img
                src={track.image}
                alt={track.name}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* Track Info */}
      {track && (
        <div className="text-center mb-4">
          <h4 className="text-sm font-medium text-white truncate">{track.name}</h4>
          <p className="text-xs text-gray-400 truncate">{track.artist}</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-4">
        <div 
          className="w-full bg-gray-700 rounded-full h-1 cursor-pointer"
          onClick={handleProgressClick}
        >
          <div 
            className="bg-green-500 h-1 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        {track && (
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime((progress / 100) * track.duration)}</span>
            <span>{formatTime(track.duration)}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center">
        <button
          onClick={onTogglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isPlaying 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default VinylPlayerBackup
