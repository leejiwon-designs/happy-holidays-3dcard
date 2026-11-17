import { useCallback, useLayoutEffect, useRef } from 'react';
import { CITY_THEMES } from '../themes/cityThemes';
import type { CityId } from '../types/card';

interface BottomGreetingProps {
  recipientName: string;
  city: CityId;
  hoverHint: string | null;
}

export function BottomGreeting({ recipientName, city, hoverHint }: BottomGreetingProps) {
  const theme = CITY_THEMES[city];
  const displayName = recipientName.trim() || 'Friend';
  const ribbonRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLParagraphElement>(null);

  const fitHeadlineToRibbon = useCallback(() => {
    const ribbon = ribbonRef.current;
    const headline = headlineRef.current;
    if (!ribbon || !headline) return;

    headline.style.fontSize = '';
    const ribbonStyle = getComputedStyle(ribbon);
    const padX = parseFloat(ribbonStyle.paddingLeft) + parseFloat(ribbonStyle.paddingRight);
    const maxWidth = Math.max(80, ribbon.clientWidth - padX);
    if (headline.scrollWidth <= maxWidth) return;

    let sizePx = parseFloat(getComputedStyle(headline).fontSize);
    if (!Number.isFinite(sizePx) || sizePx <= 0) return;

    const minPx = 11;
    const ratio = maxWidth / Math.max(1, headline.scrollWidth);
    sizePx = Math.max(minPx, Math.floor(sizePx * ratio));
    headline.style.fontSize = `${sizePx}px`;

    while (headline.scrollWidth > maxWidth && sizePx > minPx) {
      sizePx -= 1;
      headline.style.fontSize = `${sizePx}px`;
    }
  }, []);

  useLayoutEffect(() => {
    fitHeadlineToRibbon();
    let mounted = true;
    void document.fonts?.ready?.then(() => {
      if (mounted) fitHeadlineToRibbon();
    });
    window.addEventListener('resize', fitHeadlineToRibbon);
    return () => {
      mounted = false;
      window.removeEventListener('resize', fitHeadlineToRibbon);
    };
  }, [displayName, city, fitHeadlineToRibbon]);

  return (
    <footer className="bottom-greeting" aria-label="Personalized holiday greeting">
      {hoverHint && (
        <p className="hover-ornament-pill" aria-live="polite">
          {hoverHint}
        </p>
      )}
      <div className="greeting-ribbon" ref={ribbonRef}>
        <p className="greeting-headline" ref={headlineRef}>
          <span className="accent-green">Happy Holidays, </span>
          <span className="accent-red">{displayName}</span>
          <span className="accent-gold" aria-hidden="true"> ✦</span>
        </p>
        <p className="greeting-city-line">
          <span className="accent-gold" aria-hidden="true">★ </span>
          <span className="greeting-wish">{theme.cardWish}</span>
        </p>
      </div>
    </footer>
  );
}
