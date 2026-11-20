import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InnovaSceneManager } from '../three/InnovaSceneManager';
import type {
  CameraPresetId,
  InteriorSpotId,
  PaintId,
  QuadPaneId,
  QuadViewportRect,
  ViewerState,
  ViewMode,
} from '../types/viewer';
import { ViewportOverlay } from './ViewportOverlay';

export const InnovaShowcase: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<InnovaSceneManager | null>(null);

  const [quadRects, setQuadRects] = useState<QuadViewportRect[]>([]);
  const [contextLost, setContextLost] = useState(false);
  const [state, setState] = useState<ViewerState>({
    viewMode: 'quad',
    activePreset: 'hero',
    interiorSpot: 'cockpit',
    paintId: 'superWhite',
    liveryEnabled: true,
    doorsOpen: false,
    lightsOn: true,
    turntable: false,
    zoomPercent: 100,
    activeQuadPane: 'right',
    hudCollapsed: false,
  });

  // Mount WebGLRenderer & Scene ONCE (never tear down on HUD state updates)
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const manager = new InnovaSceneManager(mount, 'quad', {
      onZoomChange: (zoomPercent) => {
        setState((prev) =>
          prev.zoomPercent === zoomPercent ? prev : { ...prev, zoomPercent },
        );
      },
      onActiveQuadPaneChange: (activeQuadPane) => {
        setState((prev) =>
          prev.activeQuadPane === activeQuadPane
            ? prev
            : { ...prev, activeQuadPane },
        );
      },
      onQuadRectsChange: (rects) => {
        setQuadRects(rects);
      },
      onContextLost: (lost) => {
        setContextLost(lost);
      },
    });
    managerRef.current = manager;

    return () => {
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  const handleSelectViewMode = useCallback((mode: ViewMode) => {
    setState((prev) => {
      const nextDoors = mode === 'interior' ? true : prev.doorsOpen;
      if (mode === 'interior' && !prev.doorsOpen) {
        managerRef.current?.setDoorsOpen(true);
      }
      managerRef.current?.setViewMode(
        mode,
        mode === 'interior' ? prev.interiorSpot : prev.activePreset,
      );
      return {
        ...prev,
        viewMode: mode,
        doorsOpen: nextDoors,
      };
    });
  }, []);

  const handleSelectPreset = useCallback((preset: CameraPresetId) => {
    managerRef.current?.setViewMode('single', preset);
    setState((prev) => ({
      ...prev,
      viewMode: 'single',
      activePreset: preset,
    }));
  }, []);

  const handleSelectInteriorSpot = useCallback((spot: InteriorSpotId) => {
    managerRef.current?.setViewMode('interior', spot);
    setState((prev) => ({
      ...prev,
      viewMode: 'interior',
      interiorSpot: spot,
      activePreset: spot,
    }));
  }, []);

  const handleMaximizeQuadPane = useCallback((pane: QuadPaneId) => {
    managerRef.current?.setViewMode('single', pane);
    setState((prev) => ({
      ...prev,
      viewMode: 'single',
      activePreset: pane,
      activeQuadPane: pane,
    }));
  }, []);

  const handleZoomChange = useCallback((zoomPercent: number) => {
    managerRef.current?.setZoomPercent(zoomPercent);
    setState((prev) => ({ ...prev, zoomPercent }));
  }, []);

  const handleToggleDoors = useCallback(() => {
    setState((prev) => {
      const next = !prev.doorsOpen;
      managerRef.current?.setDoorsOpen(next);
      return { ...prev, doorsOpen: next };
    });
  }, []);

  const handleToggleLights = useCallback(() => {
    setState((prev) => {
      const next = !prev.lightsOn;
      managerRef.current?.setLightsOn(next);
      return { ...prev, lightsOn: next };
    });
  }, []);

  const handleToggleTurntable = useCallback(() => {
    setState((prev) => {
      const next = !prev.turntable;
      managerRef.current?.setTurntable(next);
      return { ...prev, turntable: next };
    });
  }, []);

  const handleSelectPaint = useCallback((paintId: PaintId) => {
    managerRef.current?.setPaint(paintId);
    setState((prev) => ({ ...prev, paintId }));
  }, []);

  const handleToggleLivery = useCallback(() => {
    setState((prev) => {
      const next = !prev.liveryEnabled;
      managerRef.current?.setLiveryVisible(next);
      return { ...prev, liveryEnabled: next };
    });
  }, []);

  const handleResetView = useCallback(() => {
    managerRef.current?.resetCurrentView();
    setState((prev) => ({
      ...prev,
      activePreset: prev.viewMode === 'single' ? 'hero' : prev.activePreset,
      interiorSpot: prev.viewMode === 'interior' ? 'cockpit' : prev.interiorSpot,
    }));
  }, []);

  const handleToggleHud = useCallback(() => {
    setState((prev) => ({ ...prev, hudCollapsed: !prev.hudCollapsed }));
  }, []);

  // Keyboard shortcuts for rapid studio inspection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'q':
          handleSelectViewMode('quad');
          break;
        case 'i':
          handleSelectViewMode('interior');
          break;
        case '0':
          handleSelectPreset('hero');
          break;
        case '1':
          handleSelectPreset('right');
          break;
        case '2':
          handleSelectPreset('left');
          break;
        case '3':
          handleSelectPreset('front');
          break;
        case '4':
          handleSelectPreset('rear');
          break;
        case 'd':
          handleToggleDoors();
          break;
        case 'l':
          handleToggleLights();
          break;
        case 'r':
          handleResetView();
          break;
        case 'h':
          handleToggleHud();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleResetView,
    handleSelectPreset,
    handleSelectViewMode,
    handleToggleDoors,
    handleToggleHud,
    handleToggleLights,
  ]);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#e9edf2]"
      data-testid="innova-showcase-root"
      data-view-mode={state.viewMode}
      data-preset={state.activePreset}
      data-paint={state.paintId}
      data-livery={state.liveryEnabled ? 'panelco' : 'clean'}
      data-doors-open={state.doorsOpen ? 'true' : 'false'}
      data-lights-on={state.lightsOn ? 'true' : 'false'}
      data-zoom-percent={String(state.zoomPercent)}
    >
      {/* Isolated dedicated WebGL canvas mount container */}
      <div
        ref={canvasMountRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Toyota Innova viewport"
      />

      {/* Sibling semantic DOM overlay */}
      <ViewportOverlay
        state={state}
        quadRects={quadRects}
        contextLost={contextLost}
        onSelectViewMode={handleSelectViewMode}
        onSelectPreset={handleSelectPreset}
        onSelectInteriorSpot={handleSelectInteriorSpot}
        onMaximizeQuadPane={handleMaximizeQuadPane}
        onZoomChange={handleZoomChange}
        onToggleDoors={handleToggleDoors}
        onToggleLights={handleToggleLights}
        onToggleTurntable={handleToggleTurntable}
        onSelectPaint={handleSelectPaint}
        onToggleLivery={handleToggleLivery}
        onResetView={handleResetView}
        onToggleHud={handleToggleHud}
      />
    </main>
  );
};
