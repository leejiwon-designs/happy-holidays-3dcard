import { useCallback, useEffect, useRef, useState } from 'react';
import { FestiveAudioEngine } from './audio/festiveAudio';
import { BottomGreeting } from './components/BottomGreeting';
import { CardControls } from './components/CardControls';
import { LoadingOverlay } from './components/LoadingOverlay';
import { OpeningOverlay } from './components/OpeningOverlay';
import { OrnamentTray } from './components/OrnamentTray';
import { CardEngine } from './scene/CardEngine';
import type { CityId, OrnamentId, PlacedOrnamentInfo } from './types/card';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CardEngine | null>(null);
  const audioRef = useRef<FestiveAudioEngine | null>(null);

  const [isCardOpen, setIsCardOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [city, setCity] = useState<CityId>('toronto');
  const [trayOpen, setTrayOpen] = useState(true);

  const [selectedOrnament, setSelectedOrnament] = useState<OrnamentId | null>(null);
  const [placedOrnaments, setPlacedOrnaments] = useState<PlacedOrnamentInfo[]>([]);
  const [hoverHint, setHoverHint] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.78);
  const [isPaused, setIsPaused] = useState(false);

  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [sceneRendered, setSceneRendered] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);

  useEffect(() => {
    void Promise.all([
      document.fonts.ready,
      document.fonts.load('400 72px "Fleur De Leah"').catch(() => []),
      document.fonts.load('400 32px "Glass Antiqua"').catch(() => []),
    ]).then(() => {
      setFontsLoaded(true);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const audio = new FestiveAudioEngine();
    audioRef.current = audio;

    const engine = new CardEngine(canvas, audio, {
      onPlacedChange: (list) => setPlacedOrnaments(list),
      onStatusAnnounce: (msg) => setStatusMessage(msg),
      onHoverHint: (hint) => setHoverHint(hint),
      onFirstFrameRendered: () => setSceneRendered(true),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.title = 'Happy Holidays from Anna Lee';
  }, [isCardOpen, recipientName, city]);

  const handleOpenCard = useCallback((name: string, chosenCity: CityId) => {
    setRecipientName(name);
    setCity(chosenCity);
    setIsCardOpen(true);

    audioRef.current?.startCardMusic();
    audioRef.current?.playCardOpen();
    engineRef.current?.openCard(name, chosenCity);
    setStatusMessage(`Opened ${chosenCity} holiday pop-up card for ${name}.`);
  }, []);

  const handleEditCard = useCallback(() => {
    setIsCardOpen(false);
    setSelectedOrnament(null);
    engineRef.current?.setSelectedTrayOrnament(null);
    engineRef.current?.closeCardToEdit();
    audioRef.current?.playStyleSwitch();
    setStatusMessage('Returned to card cover to edit recipient name or city.');
  }, []);

  const handlePreviewCityChange = useCallback((nextCity: CityId) => {
    setCity(nextCity);
    engineRef.current?.setCity(nextCity);
    audioRef.current?.playStyleSwitch();
  }, []);

  const handleSelectCity = useCallback((nextCity: CityId) => {
    setCity(nextCity);
    engineRef.current?.setCity(nextCity);
    audioRef.current?.playStyleSwitch();
    setStatusMessage(`Switched card location to ${nextCity}.`);
  }, []);

  const handleSelectOrnament = useCallback((id: OrnamentId | null) => {
    setSelectedOrnament(id);
    engineRef.current?.setSelectedTrayOrnament(id);
  }, []);

  const handleQuickAddOrnament = useCallback((id: OrnamentId) => {
    engineRef.current?.placeOrnamentNext(id);
    setSelectedOrnament(id);
    engineRef.current?.setSelectedTrayOrnament(id);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      audioRef.current?.setSoundEnabled(next);
      return next;
    });
  }, []);

  const handleToggleMusic = useCallback(() => {
    setMusicEnabled((prev) => {
      const next = !prev;
      audioRef.current?.setMusicEnabled(next);
      return next;
    });
  }, []);

  const handleChangeMusicVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setMusicVolume(clamped);
    audioRef.current?.setMusicVolume(clamped);
    if (clamped > 0) {
      setMusicEnabled(true);
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      engineRef.current?.setPaused(next);
      return next;
    });
  }, []);

  const handleExportVideo = useCallback(() => {
    if (!engineRef.current || isExportingVideo) return;
    setIsExportingVideo(true);
    setExportProgress(0);
    void engineRef.current.exportShowcaseVideo((pct) => {
      setExportProgress(pct);
    }).finally(() => {
      setIsExportingVideo(false);
      setExportProgress(0);
    });
  }, [isExportingVideo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (isCardOpen) {
        if (key === '1') handleSelectCity('toronto');
        else if (key === '2') handleSelectCity('seoul');
        else if (key === '3') handleSelectCity('vancouver');
        else if (key === 't') setTrayOpen((prev) => !prev);
      }
      if (key === 'm') handleToggleSound();
      else if (key === 'l') handleToggleMusic();
      else if (key === 'r') engineRef.current?.resetCamera();
      else if (key === 'p') handleTogglePause();
      else if (e.key === 'ArrowLeft') engineRef.current?.rotateCameraStep(-0.18);
      else if (e.key === 'ArrowRight') engineRef.current?.rotateCameraStep(0.18);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCardOpen, handleSelectCity, handleToggleSound, handleToggleMusic, handleTogglePause]);

  return (
    <main className="card-stage">
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      >
        <defs>
          <filter id="gouache-deckle" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.042" numOctaves="3" seed="11" result="paperNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="paperNoise"
              scale="4.2"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
          fontFamily: '"Fleur De Leah", cursive',
        }}
      >
        Merry Christmas
      </div>

      <canvas
        ref={canvasRef}
        className="card-canvas"
        tabIndex={0}
        aria-label="Interactive 3D gouache holiday pop-up card. Drag to rotate, scroll to zoom, or drag ornaments onto the paper tree."
      />

      {!isCardOpen ? (
        <OpeningOverlay
          initialName={recipientName}
          city={city}
          onCityPreviewChange={handlePreviewCityChange}
          onOpenCard={handleOpenCard}
        />
      ) : (
        <>
          <CardControls
            city={city}
            trayOpen={trayOpen}
            soundEnabled={soundEnabled}
            musicEnabled={musicEnabled}
            musicVolume={musicVolume}
            isPaused={isPaused}
            onSelectCity={handleSelectCity}
            onEditCard={handleEditCard}
            onToggleTray={() => setTrayOpen((prev) => !prev)}
            onToggleSound={handleToggleSound}
            onToggleMusic={handleToggleMusic}
            onChangeMusicVolume={handleChangeMusicVolume}
            onTogglePause={handleTogglePause}
          />

          {trayOpen && (
            <OrnamentTray
              selectedOrnament={selectedOrnament}
              placedCount={placedOrnaments.length}
              isExportingVideo={isExportingVideo}
              exportProgress={exportProgress}
              onSelectOrnament={handleSelectOrnament}
              onQuickAddOrnament={handleQuickAddOrnament}
              onDragStart={(id, x, y) => engineRef.current?.startExternalDrag(id, x, y)}
              onDragMove={(x, y) => engineRef.current?.moveExternalDrag(x, y) ?? false}
              onDragEnd={(x, y) => engineRef.current?.dropExternalDrag(x, y) ?? false}
              onDragCancel={() => engineRef.current?.cancelExternalDrag()}
              onAutoDecorate={() => engineRef.current?.autoDecorateAll()}
              onClearTree={() => engineRef.current?.clearTree()}
              onExportVideo={handleExportVideo}
            />
          )}

          <BottomGreeting
            recipientName={recipientName}
            city={city}
            hoverHint={hoverHint}
          />
        </>
      )}

      <div className="visually-hidden" aria-live="polite">
        {statusMessage}
      </div>

      {!loaderDone && (
        <LoadingOverlay
          fontsLoaded={fontsLoaded}
          sceneRendered={sceneRendered}
          onComplete={() => setLoaderDone(true)}
        />
      )}
    </main>
  );
}

export default App;
