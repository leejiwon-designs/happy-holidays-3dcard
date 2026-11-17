import { useEffect, useRef, useState } from 'react';
import { CITY_ORDER, CITY_THEMES } from '../themes/cityThemes';
import type { CityId } from '../types/card';

interface CardControlsProps {
  city: CityId;
  trayOpen: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  isPaused: boolean;
  onSelectCity: (city: CityId) => void;
  onEditCard: () => void;
  onToggleTray: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onChangeMusicVolume: (volume: number) => void;
  onTogglePause: () => void;
}

export function CardControls({
  city,
  trayOpen,
  soundEnabled,
  musicEnabled,
  musicVolume,
  isPaused,
  onSelectCity,
  onEditCard,
  onToggleTray,
  onToggleSound,
  onToggleMusic,
  onChangeMusicVolume,
  onTogglePause,
}: CardControlsProps) {
  const theme = CITY_THEMES[city];
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!volumeOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (volumeWrapRef.current && !volumeWrapRef.current.contains(e.target as Node)) {
        setVolumeOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVolumeOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [volumeOpen]);

  const cssVars = {
    '--ui-ink': theme.uiInkColor,
    '--ui-halo': theme.uiHalo,
  } as React.CSSProperties;

  const pct = musicEnabled ? Math.round(musicVolume * 100) : 0;

  return (
    <header className="top-bar" style={cssVars}>
      <nav className="city-switcher" aria-label="City card themes">
        {CITY_ORDER.map((cid) => {
          const c = CITY_THEMES[cid];
          const active = city === cid;
          return (
            <button
              key={cid}
              type="button"
              className={`city-tab-btn ${active ? 'is-active' : ''}`}
              onClick={() => onSelectCity(cid)}
              aria-pressed={active}
            >
              {c.name}
            </button>
          );
        })}
        <button
          type="button"
          className="city-tab-btn edit-btn"
          onClick={onEditCard}
          aria-label="Edit recipient name and refold card"
        >
          Edit Name
        </button>
      </nav>

      <div className="icon-toolbar" role="toolbar" aria-label="Card controls">
        <button
          type="button"
          className="circle-icon-btn"
          onClick={onToggleTray}
          aria-label="Ornament tray"
          aria-pressed={trayOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle
              cx="12"
              cy="14"
              r="6.2"
              fill={trayOpen ? 'currentColor' : 'none'}
              fillOpacity={trayOpen ? 0.14 : 0}
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M8.5 13.5q3.5 2.5 7 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <button
          type="button"
          className="circle-icon-btn"
          onClick={onToggleSound}
          aria-label="Sound effects"
          aria-pressed={soundEnabled}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 9.5h4l5-4.2v13.4l-5-4.2H4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            {soundEnabled ? (
              <>
                <path
                  d="M16.2 9.2a4.2 4.2 0 0 1 0 5.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M18.8 6.8a7.4 7.4 0 0 1 0 10.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <path
                d="M16.5 9.5l4.2 5M20.7 9.5l-4.2 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>

        <div className="music-control-anchor" ref={volumeWrapRef}>
          {volumeOpen && (
            <div
              id="music-volume-popover"
              className="music-volume-popover"
              role="group"
              aria-label="Music volume control"
            >
              <div className="music-volume-header">
                <label htmlFor="music-volume-slider" className="music-volume-label">
                  Music
                </label>
                <span className="music-volume-pct">{pct}%</span>
              </div>
              <input
                id="music-volume-slider"
                className="music-volume-slider"
                type="range"
                min={0}
                max={100}
                value={pct}
                aria-label="Adjust festive music volume"
                onChange={(e) => onChangeMusicVolume(Number(e.target.value) / 100)}
              />
              <button
                type="button"
                className={`music-mute-pill ${musicEnabled ? 'is-on' : ''}`}
                onClick={onToggleMusic}
              >
                {musicEnabled ? 'Mute Music' : 'Unmute Music'}
              </button>
            </div>
          )}

          <button
            type="button"
            className="circle-icon-btn"
            onClick={() => setVolumeOpen((prev) => !prev)}
            aria-label="Music volume and controls"
            aria-pressed={musicEnabled}
            aria-expanded={volumeOpen}
            aria-controls="music-volume-popover"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 16.5V6.6l8.5-1.9v9.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="7"
                cy="17"
                r="2.4"
                fill={musicEnabled ? 'currentColor' : 'none'}
                fillOpacity={musicEnabled ? 0.18 : 0}
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle
                cx="15.5"
                cy="15.1"
                r="2.4"
                fill={musicEnabled ? 'currentColor' : 'none'}
                fillOpacity={musicEnabled ? 0.18 : 0}
                stroke="currentColor"
                strokeWidth="1.7"
              />
              {!musicEnabled && (
                <path
                  d="M5.2 19.2L19.2 5.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="circle-icon-btn"
          onClick={onTogglePause}
          aria-label={isPaused ? 'Resume animation' : 'Pause animation'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {isPaused ? (
              <path
                d="M9.5 7.4l7.6 4.6-7.6 4.6z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            ) : (
              <>
                <line
                  x1="9.4"
                  y1="7.5"
                  x2="9.4"
                  y2="16.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <line
                  x1="14.6"
                  y1="7.5"
                  x2="14.6"
                  y2="16.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
