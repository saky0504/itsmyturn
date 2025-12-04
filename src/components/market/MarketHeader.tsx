import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { CommunityBoard } from '../../../components/CommunityBoard';

export function MarketHeader() {
  const [showBoard, setShowBoard] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="text-2xl font-bold text-foreground hover:text-primary transition-colors">
              LP 마켓
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBoard(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent hover:rounded-full transition-all"
                aria-label="게시판 열기"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <a
                href="https://buymeacoffee.com/mtfbwy"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-80 transition-opacity"
                aria-label="도네이션"
              >
                <img 
                  src="/images/bymeacoffee.jpg" 
                  alt="Buy me a Coffee"
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.classList.add('p-2', 'rounded-lg', 'text-muted-foreground', 'hover:text-foreground', 'hover:bg-accent', 'transition-colors');
                      parent.innerHTML = '💝';
                    }
                  }}
                />
              </a>
            </div>
          </div>
        </div>
      </div>
      <CommunityBoard isOpen={showBoard} onClose={() => setShowBoard(false)} />
    </>
  );
}

