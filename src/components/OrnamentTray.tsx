import { useRef, useState } from 'react';
import { ORNAMENT_CATALOG } from '../scene/ornamentCatalog';
import type { OrnamentId } from '../types/card';
import { OrnamentIcon } from './OrnamentIcon';

interface OrnamentTrayProps {
  selectedOrnament: OrnamentId | null;
  placedCount: number;
  isExportingVideo: boolean;
  exportProgress: number;
  onSelectOrnament: (id: OrnamentId | null) => void;
  onQuickAddOrnament: (id: OrnamentId) => void;
  onDragStart: (id: OrnamentId, clientX: number, clientY: number) => void;
  onDragMove: (clientX: number, clientY: number) => boolean;
  onDragEnd: (clientX: number, clientY: number) => boolean;
  onDragCancel: () => void;
  onAutoDecorate: () => void;
  onClearTree: () => void;
  onExportVideo: () => void;
}

export function OrnamentTray({
  selectedOrnament,
  placedCount,
  isExportingVideo,
  exportProgress,
  onSelectOrnament,
  onQuickAddOrnament,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onAutoDecorate,
  onClearTree,
  onExportVideo,
}: OrnamentTrayProps) {
  const [draggingId, setDraggingId] = useState<OrnamentId | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [overTree, setOverTree] = useState(false);

  const pendingDragRef = useRef<{
    id: OrnamentId;
    startX: number;
    startY: number;
    active: boolean;
    pointerId: number;
  } | null>(null);

  const handleChipPointerDown = (id: OrnamentId, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    pendingDragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleChipPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pendingDragRef.current;
    if (!p || p.pointerId !== e.pointerId) return;

    const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    if (!p.active && dist > 6) {
      p.active = true;
      setDraggingId(p.id);
      setDragPos({ x: e.clientX, y: e.clientY });
      onDragStart(p.id, e.clientX, e.clientY);
    }

    if (p.active) {
      setDragPos({ x: e.clientX, y: e.clientY });
      const isOver = onDragMove(e.clientX, e.clientY);
      setOverTree(isOver);
    }
  };

  const handleChipPointerUp = (id: OrnamentId, e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pendingDragRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    pendingDragRef.current = null;

    if (p && p.active) {
      onDragEnd(e.clientX, e.clientY);
      setDraggingId(null);
      setOverTree(false);
    } else {
      // Tap/click behavior: toggle selection OR add directly if double-selected
      if (selectedOrnament === id) {
        onQuickAddOrnament(id);
      } else {
        onSelectOrnament(id);
      }
    }
  };

  const handleChipPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (pendingDragRef.current?.active) {
      onDragCancel();
    }
    pendingDragRef.current = null;
    setDraggingId(null);
    setOverTree(false);
  };

  return (
    <>
      <aside className="ornament-tray" aria-label="Quirky 3D ornament tray">
        <div className="ornament-tray-scroll">
          <div className="tray-header">
          <span className="tray-title">
            Ornaments <span className="tray-count">({placedCount})</span>
          </span>
          <div className="tray-actions">
            <button
              type="button"
              className="tray-mini-btn is-gold"
              onClick={onAutoDecorate}
            >
              Auto-Decorate
            </button>
            <button
              type="button"
              className="tray-mini-btn"
              onClick={onClearTree}
              disabled={placedCount === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <p className="tray-hint">
          {selectedOrnament
            ? 'Tap a gold ledge spot on the tree (or tap again to place)!'
            : 'Drag any charm onto a tree ledge, or tap to pick.'}
        </p>

        <div className="ornament-grid" role="list">
          {ORNAMENT_CATALOG.map((item) => {
            const isSelected = selectedOrnament === item.id;
            return (
              <div key={item.id} className="ornament-cell" role="listitem">
                <button
                  type="button"
                  className={`ornament-chip ${isSelected ? 'is-selected' : ''}`}
                  aria-label={`${item.label} ornament. Drag to tree or press to select`}
                  aria-pressed={isSelected}
                  onPointerDown={(e) => handleChipPointerDown(item.id, e)}
                  onPointerMove={handleChipPointerMove}
                  onPointerUp={(e) => handleChipPointerUp(item.id, e)}
                  onPointerCancel={handleChipPointerCancel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onQuickAddOrnament(item.id);
                    }
                  }}
                >
                  <span className="ornament-chip-icon">
                    <OrnamentIcon id={item.id} />
                  </span>
                  <span className="ornament-chip-name">{item.shortLabel}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="tray-export-footer">
          <button
            type="button"
            className={`tray-export-btn ${isExportingVideo ? 'is-recording' : ''}`}
            onClick={onExportVideo}
            disabled={isExportingVideo}
            aria-label={isExportingVideo ? `Saving video ${exportProgress}%` : 'Save pop-up card as video'}
          >
            <svg viewBox="0 0 24 24" className="tray-export-icon" aria-hidden="true">
              <rect x="3" y="6.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 10l5-3v10l-5-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <span>{isExportingVideo ? `Saving... ${exportProgress}%` : 'Save Video'}</span>
          </button>
        </div>
        </div>
      </aside>

      {draggingId && !overTree && (
        <div
          className="floating-drag-ghost"
          style={{
            transform: `translate(${dragPos.x - 24}px, ${dragPos.y - 24}px)`,
          }}
          aria-hidden="true"
        >
          <OrnamentIcon id={draggingId} />
        </div>
      )}
    </>
  );
}
