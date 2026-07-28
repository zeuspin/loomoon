import type { PanelState, PersistedPanelState } from "../contracts/types";

export function serializePanelState(panel: PanelState): PersistedPanelState {
  return {
    placement: panel.placement,
    visibility: panel.visibility === "peek" ? "collapsed" : panel.visibility,
    persistence: panel.persistence,
  };
}

function numericToken(name: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) throw new Error(`Missing numeric theme token: ${name}`);
  return value;
}

export function canvasTheme() {
  return {
    selectionStrokeWidth: numericToken("--canvas-selection-stroke-width"),
    panelDurationMs: numericToken("--motion-panel-duration-ms"),
  };
}

