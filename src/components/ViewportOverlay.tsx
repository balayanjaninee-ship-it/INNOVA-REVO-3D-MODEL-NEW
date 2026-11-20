import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Lightbulb,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import {
  PAINT_FINISHES,
  type CameraPresetId,
  type InteriorSpotId,
  type PaintId,
  type QuadPaneId,
  type QuadViewportRect,
  type ViewerState,
  type ViewMode,
} from '../types/viewer';

interface ViewportOverlayProps {
  state: ViewerState;
  quadRects: QuadViewportRect[];
  contextLost: boolean;
  onSelectViewMode: (mode: ViewMode) => void;
  onSelectPreset: (preset: CameraPresetId) => void;
  onSelectInteriorSpot: (spot: InteriorSpotId) => void;
  onMaximizeQuadPane: (pane: QuadPaneId) => void;
  onZoomChange: (zoomPercent: number) => void;
  onToggleDoors: () => void;
  onToggleLights: () => void;
  onToggleTurntable: () => void;
  onSelectPaint: (paintId: PaintId) => void;
  onToggleLivery: () => void;
  onResetView: () => void;
  onToggleHud: () => void;
}

const EXTERIOR_PRESETS: { id: CameraPresetId; label: string }[] = [
  { id: 'hero', label: '3/4' },
  { id: 'right', label: 'Right' },
  { id: 'left', label: 'Left' },
  { id: 'front', label: 'Front' },
  { id: 'rear', label: 'Rear' },
  { id: 'top', label: 'Top' },
];

const INTERIOR_SPOTS: { id: InteriorSpotId; label: string }[] = [
  { id: 'cockpit', label: 'Driver Cockpit' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'secondRow', label: 'Second Row' },
  { id: 'fullCabin', label: 'Full Cabin' },
];

const PANE_LABEL_MAP: Record<QuadPaneId, string> = {
  right: 'Right Side',
  left: 'Left Side',
  front: 'Front',
  rear: 'Rear',
};

export const ViewportOverlay: React.FC<ViewportOverlayProps> = ({
  state,
  quadRects,
  contextLost,
  onSelectViewMode,
  onSelectPreset,
  onSelectInteriorSpot,
  onMaximizeQuadPane,
  onZoomChange,
  onToggleDoors,
  onToggleLights,
  onToggleTurntable,
  onSelectPaint,
  onToggleLivery,
  onResetView,
  onToggleHud,
}) => {
  const stepZoom = (delta: number) => {
    onZoomChange(Math.max(35, Math.min(450, state.zoomPercent + delta)));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* Slim 3-Zone Top Bar (solid surface, zero backdrop-filter over WebGL) */}
      <header className="pointer-events-auto flex h-12 sm:h-[52px] w-full items-center justify-between gap-1.5 sm:gap-8 border-b border-slate-900/10 bg-[#f6f8fa]/95 px-2.5 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <h1
          className="text-xs sm:text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Innova<span className="hidden sm:inline"> AN140</span>
        </h1>

        {/* Zone 2: Primary View Mode Segmented Switcher */}
        <nav
          aria-label="Viewport mode"
          className="flex items-center gap-0.5 sm:gap-1 rounded-lg bg-slate-900/[0.06] p-0.5 sm:p-1 shrink-0"
        >
          {(
            [
              { id: 'quad', label: '4-View', shortLabel: '4-View' },
              { id: 'single', label: '360° Studio', shortLabel: '360°' },
              { id: 'interior', label: 'Cabin Interior', shortLabel: 'Cabin' },
            ] as { id: ViewMode; label: string; shortLabel: string }[]
          ).map((tab) => {
            const active = state.viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.label}
                aria-pressed={active}
                onClick={() => onSelectViewMode(tab.id)}
                className={`min-h-[34px] sm:min-h-[32px] px-2 sm:px-3.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 ${
                  active
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onResetView}
            aria-label="Reset camera view"
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 sm:px-3.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Reset View</span>
          </button>
        </div>
      </header>

      {/* 4-View Quad Hairline Dividers, Labels & Expand Buttons */}
      {state.viewMode === 'quad' && quadRects.length === 4 && (
        <div className="pointer-events-none fixed inset-0 z-10" aria-label="Four view perspective labels">
          {quadRects.map((rect) => {
            const isSelected = state.activeQuadPane === rect.id;
            return (
              <div
                key={rect.id}
                style={{
                  left: `${rect.cssLeft}px`,
                  top: `${rect.cssTop}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                }}
                className={`pointer-events-none absolute border-slate-900/12 ${
                  rect.cssLeft > 0 ? 'border-l' : ''
                } ${rect.cssTop > 60 ? 'border-t' : ''}`}
              >
                {/* Top-left subtle quadrant title (unboxed typography, zero pills) */}
                <div className="flex items-center justify-between px-3 py-2">
                  <span
                    className={`text-[11px] sm:text-xs font-medium tracking-tight ${
                      isSelected ? 'text-slate-950' : 'text-slate-600'
                    }`}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {rect.label}
                  </span>
                  <button
                    type="button"
                    aria-label={`Maximize ${rect.label}`}
                    onClick={() => onMaximizeQuadPane(rect.id)}
                    className="pointer-events-auto inline-flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md bg-white/85 text-slate-700 border border-slate-900/10 hover:bg-white hover:text-slate-950 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900"
                    title={`Inspect ${rect.label} in 360°`}
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WebGL Context Lost Graceful Fallback Banner */}
      {contextLost && (
        <div
          role="alert"
          className="pointer-events-auto mx-auto my-auto max-w-sm rounded-xl border border-slate-900/15 bg-white p-6 text-center shadow-md"
        >
          <p className="text-sm font-semibold text-slate-900">3D Graphics Context Paused</p>
          <p className="mt-1 text-xs text-slate-600">
            WebGL rendering was interrupted by the browser. Reload or restore to continue inspecting the Innova 3D model.
          </p>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        className={`pointer-events-none fixed bottom-2.5 sm:bottom-4 left-1/2 z-20 flex w-fit max-w-[96vw] -translate-x-1/2 flex-col items-center transition-transform duration-200 ease-out ${
          state.hudCollapsed ? 'translate-y-[calc(100%-26px)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse / Expand Zen Mode Tab */}
        <button
          type="button"
          onClick={onToggleHud}
          aria-expanded={!state.hudCollapsed}
          aria-label={state.hudCollapsed ? 'Show controls' : 'Hide controls'}
          className="pointer-events-auto inline-flex h-7 items-center gap-1 rounded-t-lg border border-b-0 border-slate-900/12 bg-[#f8fafc]/95 px-3 text-[11px] font-medium text-slate-600 hover:text-slate-950 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          {state.hudCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {/* Compact Horizontal Dock Container (single-row on desktop, sleek scrollable strip on mobile) */}
        <div className="pointer-events-auto flex max-w-full items-center gap-2 sm:gap-2.5 overflow-x-auto rounded-xl border border-slate-900/12 bg-[#f8fafc]/96 px-2.5 sm:px-3 py-1.5 shadow-sm">
          {/* Section A: Contextual Angles / Interior Spots */}
          {state.viewMode === 'single' && (
            <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Camera angles">
              {EXTERIOR_PRESETS.map((p) => {
                const active = state.activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectPreset(p.id)}
                    className={`min-h-[36px] sm:min-h-[32px] px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-900/8 hover:text-slate-950'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {state.viewMode === 'interior' && (
            <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Interior cabin viewpoints">
              {INTERIOR_SPOTS.map((spot) => {
                const active = state.interiorSpot === spot.id;
                return (
                  <button
                    key={spot.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectInteriorSpot(spot.id)}
                    className={`min-h-[36px] sm:min-h-[32px] px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-900/8 hover:text-slate-950'
                    }`}
                  >
                    {spot.label}
                  </button>
                );
              })}
            </div>
          )}

          {state.viewMode === 'quad' && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap shrink-0 pr-1">
              <span className="font-medium text-slate-900">{PANE_LABEL_MAP[state.activeQuadPane]}</span>
              <span aria-hidden="true">·</span>
              <span>Drag any pane to orbit</span>
            </div>
          )}

          <div className="h-5 w-px bg-slate-900/12 shrink-0" aria-hidden="true" />

          {/* Section B: Intuitive Zoom Slider + Stepper (Exterior to Cabin Close-up) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => stepZoom(-25)}
              className="inline-flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-900/8 hover:text-slate-950 transition-colors cursor-pointer shrink-0"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <label htmlFor="innova-zoom-slider" className="sr-only">
              Camera zoom level
            </label>
            <input
              id="innova-zoom-slider"
              type="range"
              min={35}
              max={450}
              step={5}
              value={state.zoomPercent}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="studio-range w-20 sm:w-24 cursor-pointer"
            />
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => stepZoom(25)}
              className="inline-flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-900/8 hover:text-slate-950 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span
              className="w-10 text-right text-[11px] font-medium text-slate-700 tabular-nums shrink-0"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {state.zoomPercent}%
            </span>
          </div>

          <div className="h-5 w-px bg-slate-900/12 shrink-0" aria-hidden="true" />

          {/* Section C: Interactive Vehicle Features (Doors, Lights, Turntable) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-pressed={state.doorsOpen}
              onClick={onToggleDoors}
              className={`inline-flex min-h-[36px] sm:min-h-[32px] items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.doorsOpen
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-900/8 hover:text-slate-950'
              }`}
            >
              <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Doors</span>
            </button>

            <button
              type="button"
              aria-pressed={state.lightsOn}
              onClick={onToggleLights}
              className={`inline-flex min-h-[36px] sm:min-h-[32px] items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.lightsOn
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-900/8 hover:text-slate-950'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Lights</span>
            </button>

            <button
              type="button"
              aria-pressed={state.turntable}
              onClick={onToggleTurntable}
              className={`inline-flex min-h-[36px] sm:min-h-[32px] items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.turntable
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-900/8 hover:text-slate-950'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Spin</span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-900/12 shrink-0" aria-hidden="true" />

          {/* Section D: Paint Swatches & PANELCO III Fleet Livery Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5" role="group" aria-label="Body paint finishes">
              {PAINT_FINISHES.map((paint) => {
                const selected = state.paintId === paint.id;
                return (
                  <button
                    key={paint.id}
                    type="button"
                    aria-label={`Paint finish ${paint.name}`}
                    aria-pressed={selected}
                    title={paint.name}
                    onClick={() => onSelectPaint(paint.id)}
                    className={`h-6 w-6 sm:h-5 sm:w-5 rounded-full border transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                      selected
                        ? 'scale-110 border-slate-950 ring-2 ring-slate-900/25'
                        : 'border-slate-900/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: paint.swatchHex }}
                  />
                );
              })}
            </div>

            <button
              type="button"
              aria-pressed={state.liveryEnabled}
              onClick={onToggleLivery}
              className={`min-h-[36px] sm:min-h-[32px] rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.liveryEnabled
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 border border-slate-900/15 hover:bg-slate-900/8 hover:text-slate-950'
              }`}
            >
              PANELCO III
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
