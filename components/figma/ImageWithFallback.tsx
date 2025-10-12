import React, { useState } from 'react'

// 오리 이미지를 사용 (커버 로딩 실패 시)
const DUCK_FALLBACK_SRC = '/images/duck-fallback.svg'

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, ...rest } = props

  return didError ? (
    <img 
      src={DUCK_FALLBACK_SRC} 
      alt="Music Loading" 
      className={`${className ?? ''} animate-pulse`} 
      style={style} 
      {...rest}
    />
  ) : (
    <img src={src} alt={alt} className={className} style={style} {...rest} onError={handleError} />
  )
}
