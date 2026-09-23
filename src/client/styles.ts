import { PLUGIN_ID } from '../constants.ts'

/**
 * Host tokens first (DSH web --dsw-* variables), local fallbacks second.
 * Fallback and palette values switch with prefers-color-scheme.
 */
export const STYLE_TEXT = `
.dshc-root {
  --dshc-fb-fg: #1f2328; --dshc-fb-fg2: #57606a; --dshc-fb-fg3: #8c959f;
  --dshc-fb-border: #d0d7de; --dshc-fb-bg: #ffffff; --dshc-fb-bg2: #f6f8fa;
  --dshc-fb-good: #1a7f37; --dshc-fb-bad: #cf222e; --dshc-fb-warn: #9a6700; --dshc-fb-info: #0969da;
  --dshc-c1: #3b6fd8; --dshc-c2: #e08a1e; --dshc-c3: #2a9d6f; --dshc-c4: #d64550; --dshc-c5: #8a5cd1; --dshc-c6: #1b9bb5;
  --dshc-fg: var(--dsw-alias-label-primary, var(--dshc-fb-fg));
  --dshc-fg2: var(--dsw-alias-label-secondary, var(--dshc-fb-fg2));
  --dshc-fg3: var(--dsw-alias-label-tertiary, var(--dshc-fb-fg3));
  --dshc-border: var(--dsw-alias-border-l1, var(--dshc-fb-border));
  --dshc-bg: var(--dsw-alias-bg-base, var(--dshc-fb-bg));
  --dshc-bg2: var(--dsw-alias-bg-layer-1, var(--dshc-fb-bg2));
  --dshc-good: var(--dsw-alias-state-success-primary, var(--dshc-fb-good));
  --dshc-bad: var(--dsw-alias-state-error-primary, var(--dshc-fb-bad));
  --dshc-warn: var(--dsw-alias-state-warn-primary, var(--dshc-fb-warn));
  --dshc-info: var(--dsw-alias-brand-primary, var(--dshc-fb-info));
  display: flex; flex-direction: column; gap: 12px; min-width: 0;
  padding: 14px; border: 1px solid var(--dshc-border); border-radius: 10px;
  background: var(--dshc-bg); color: var(--dshc-fg); font-size: 14px; line-height: 1.5;
}
@media (prefers-color-scheme: dark) {
  .dshc-root {
    --dshc-fb-fg: #e6edf3; --dshc-fb-fg2: #9da7b3; --dshc-fb-fg3: #6e7681;
    --dshc-fb-border: #30363d; --dshc-fb-bg: #0d1117; --dshc-fb-bg2: #161b22;
    --dshc-fb-good: #3fb950; --dshc-fb-bad: #f85149; --dshc-fb-warn: #d29922; --dshc-fb-info: #58a6ff;
    --dshc-c1: #6e9bf5; --dshc-c2: #f0a44b; --dshc-c3: #4cc38a; --dshc-c4: #f07178; --dshc-c5: #b18cf2; --dshc-c6: #4fc3dc;
  }
}
.dshc-root * { box-sizing: border-box; }
.dshc-title { font-size: 16px; font-weight: 600; }
.dshc-h2 { font-size: 16px; font-weight: 600; margin: 0; }
.dshc-h3 { font-size: 14px; font-weight: 600; margin: 0; }
.dshc-text { margin: 0; }
.dshc-muted { color: var(--dshc-fg2); }
.dshc-code { font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 0.92em; padding: 0 4px; border-radius: 4px; background: var(--dshc-bg2); }
.dshc-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; }
.dshc-row > * { flex: 1 1 180px; min-width: 0; }
.dshc-grid { display: grid; gap: 12px; grid-template-columns: repeat(var(--dshc-cols, 2), minmax(0, 1fr)); }
@media (max-width: 640px) { .dshc-grid { grid-template-columns: minmax(0, 1fr); } }
.dshc-card { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--dshc-border); border-radius: 8px; background: var(--dshc-bg2); min-width: 0; }
.dshc-card-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--dshc-fg2); }
.dshc-callout { padding: 10px 12px; border-radius: 8px; border-left: 3px solid var(--dshc-info); background: var(--dshc-bg2); }
.dshc-callout.dshc-tone-success { border-left-color: var(--dshc-good); }
.dshc-callout.dshc-tone-warning { border-left-color: var(--dshc-warn); }
.dshc-callout.dshc-tone-error { border-left-color: var(--dshc-bad); }
.dshc-callout-title { font-weight: 600; margin-bottom: 2px; }
.dshc-list { margin: 0; padding-left: 20px; }
.dshc-kv { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
.dshc-kv-row { display: contents; }
.dshc-kv dt { color: var(--dshc-fg2); }
.dshc-kv dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.dshc-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; border: 1px solid var(--dshc-border); color: var(--dshc-fg2); }
.dshc-badge.dshc-tone-info { color: var(--dshc-info); border-color: currentColor; }
.dshc-badge.dshc-tone-success { color: var(--dshc-good); border-color: currentColor; }
.dshc-badge.dshc-tone-warning { color: var(--dshc-warn); border-color: currentColor; }
.dshc-badge.dshc-tone-error { color: var(--dshc-bad); border-color: currentColor; }
.dshc-stat { display: flex; flex-direction: column; gap: 2px; padding: 12px; border: 1px solid var(--dshc-border); border-radius: 8px; min-width: 0; }
.dshc-stat-label { font-size: 12px; color: var(--dshc-fg2); }
.dshc-stat-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dshc-delta { font-size: 12px; color: var(--dshc-fg3); }
.dshc-delta-good { color: var(--dshc-good); }
.dshc-delta-bad { color: var(--dshc-bad); }
.dshc-spark { width: 100%; height: 24px; margin-top: 4px; }
.dshc-spark polyline { fill: none; stroke: var(--dshc-c1); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.dshc-table-wrap { overflow-x: auto; }
.dshc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dshc-table th, .dshc-table td { padding: 6px 10px; border-bottom: 1px solid var(--dshc-border); text-align: left; white-space: nowrap; }
.dshc-table th { font-weight: 600; color: var(--dshc-fg2); }
.dshc-table .dshc-num { text-align: right; font-variant-numeric: tabular-nums; }
.dshc-sort { all: unset; cursor: pointer; }
.dshc-sort:focus-visible { outline: 2px solid var(--dshc-info); outline-offset: 2px; }
.dshc-sort-mark { display: inline-block; width: 1em; margin-left: 2px; }
.dshc-bar-cell { display: inline-flex; align-items: center; gap: 8px; }
.dshc-bar { display: inline-block; width: 64px; height: 6px; border-radius: 3px; background: var(--dshc-bg2); overflow: hidden; }
.dshc-bar-fill { display: block; height: 100%; background: var(--dshc-c1); }
.dshc-chart { margin: 0; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dshc-chart-title { font-weight: 600; }
.dshc-chart-svg { width: 100%; height: auto; }
.dshc-donut { max-width: 200px; align-self: center; }
.dshc-gridline { stroke: var(--dshc-border); stroke-width: 1; }
.dshc-zero { stroke: var(--dshc-fg3); }
.dshc-tick { fill: var(--dshc-fg3); font-size: 11px; }
.dshc-line { fill: none; stroke: currentColor; stroke-width: 2; }
.dshc-dot { fill: currentColor; }
.dshc-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--dshc-fg2); }
.dshc-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.dshc-note { color: var(--dshc-fg2); font-size: 13px; }
.dshc-note summary { cursor: pointer; }
.dshc-pre { margin: 8px 0 0; white-space: pre-wrap; font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 12px; }
`

/** Add the stylesheet once; the returned disposer removes only a tag this call created. */
export function installStyle(doc: Document): () => void {
  if (doc.querySelector(`style[data-plugin="${PLUGIN_ID}"]`) !== null) return () => undefined
  const tag = doc.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.textContent = STYLE_TEXT
  doc.head.appendChild(tag)
  return () => tag.remove()
}
