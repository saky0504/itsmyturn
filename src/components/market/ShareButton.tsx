import { useEffect, useState } from 'react';
import { Share2, X, Copy, QrCode, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  className?: string;
}

function buildShareUrl(url: string, source: string) {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', 'share');
    u.searchParams.set('utm_campaign', 'lp_detail');
    return u.toString();
  } catch {
    return url;
  }
}

export function ShareButton({ title, text, url, className }: ShareButtonProps) {
  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleShare = async () => {
    if (canUseNativeShare) {
      try {
        await navigator.share({
          title,
          text,
          url: buildShareUrl(url, 'native'),
        });
        return;
      } catch (err) {
        // User cancelled — silent
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    setIsFallbackOpen(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(url, 'copy'));
      setCopied(true);
      toast.success('링크가 복사되었습니다');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('복사에 실패했습니다');
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${title}\n${text}`
  )}&url=${encodeURIComponent(buildShareUrl(url, 'twitter'))}`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    buildShareUrl(url, 'qr')
  )}`;

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label="공유하기"
        className={
          className ??
          'inline-flex items-center justify-center h-8 gap-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all duration-200 shadow-sm'
        }
      >
        <Share2 className="w-4 h-4" />
        <span>공유</span>
      </button>

      {isFallbackOpen && (
        <ShareFallback
          title={title}
          url={buildShareUrl(url, 'dialog')}
          twitterUrl={twitterUrl}
          qrUrl={qrUrl}
          showQr={showQr}
          copied={copied}
          onClose={() => {
            setIsFallbackOpen(false);
            setShowQr(false);
          }}
          onCopy={handleCopy}
          onToggleQr={() => setShowQr((v) => !v)}
        />
      )}
    </>
  );
}

interface ShareFallbackProps {
  title: string;
  url: string;
  twitterUrl: string;
  qrUrl: string;
  showQr: boolean;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
  onToggleQr: () => void;
}

function ShareFallback({
  title,
  url,
  twitterUrl,
  qrUrl,
  showQr,
  copied,
  onClose,
  onCopy,
  onToggleQr,
}: ShareFallbackProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="공유하기"
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">공유하기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground break-all line-clamp-2">
          {url}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors py-4"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5 text-foreground" />
            )}
            <span className="text-xs font-medium text-foreground">
              {copied ? '복사됨' : '링크 복사'}
            </span>
          </button>

          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors py-4"
          >
            <svg className="w-5 h-5 fill-foreground" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-xs font-medium text-foreground">X</span>
          </a>

          <button
            type="button"
            onClick={onToggleQr}
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors py-4"
          >
            <QrCode className="w-5 h-5 text-foreground" />
            <span className="text-xs font-medium text-foreground">QR 코드</span>
          </button>
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-border">
            <img
              src={qrUrl}
              alt={`${title} 공유 QR 코드`}
              width={220}
              height={220}
              className="rounded-lg bg-white p-2"
              loading="lazy"
            />
            <p className="text-xs text-muted-foreground">스캔해서 열기</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareButton;
