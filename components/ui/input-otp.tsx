import React, { useState, useRef, useEffect } from 'react'

interface InputOTPProps {
  length?: number
  value?: string
  onChange?: (value: string) => void
  className?: string
  disabled?: boolean
}

const InputOTP: React.FC<InputOTPProps> = ({
  length = 6,
  value = '',
  onChange,
  className = '',
  disabled = false
}) => {
  const [otp, setOtp] = useState(value.split('').slice(0, length))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const newOtp = value.split('').slice(0, length)
    setOtp(newOtp)
  }, [value, length])

  const handleChange = (index: number, inputValue: string) => {
    if (disabled) return

    const newOtp = [...otp]
    newOtp[index] = inputValue.slice(-1) // Only take the last character
    setOtp(newOtp)

    const otpValue = newOtp.join('')
    onChange?.(otpValue)

    // Auto-focus next input
    if (inputValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (disabled) return

    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return

    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, length)
    const pastedOtp = pastedData.split('')
    
    const newOtp = [...otp]
    pastedOtp.forEach((char, index) => {
      if (index < length) {
        newOtp[index] = char
      }
    })
    
    setOtp(newOtp)
    onChange?.(newOtp.join(''))

    // Focus the next empty input or the last input
    const nextEmptyIndex = newOtp.findIndex((char, index) => !char && index < length)
    const focusIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : length - 1
    inputRefs.current[focusIndex]?.focus()
  }

  return (
    <div className={`flex space-x-2 ${className}`}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={otp[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`w-12 h-12 text-center text-lg font-semibold border border-gray-600 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        />
      ))}
    </div>
  )
}

export default InputOTP
