// Google "G" 로고 — 사용자 제공 모노톤 webp (public/images/google_logo.webp)
export function GoogleIconMono({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <img
      src="/images/google_logo.webp"
      alt=""
      aria-hidden="true"
      className={`${className} object-contain`}
      draggable={false}
    />
  );
}
