import { Link } from 'react-router-dom';
import { UserMenu } from '../auth/UserMenu';

export function MarketHeader() {
  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4" style={{ paddingRight: 'calc(var(--scrollbar-width, 0px) + clamp(1rem, 4vw, 2rem))' }}>
        <div className="flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img
              src="/images/back.png"
              alt="itsmyturn"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <img
              src="/images/itsmyturn-logo.svg"
              alt="itsmyturn"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </Link>
          <div className="flex items-center gap-3">
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
                className="h-8 w-auto object-contain rounded-sm"
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
            <UserMenu />
          </div>
        </div>
      </div>
    </div>
  );
}
