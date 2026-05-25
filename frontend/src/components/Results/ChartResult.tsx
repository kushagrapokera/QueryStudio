import { useEffect, useRef, useState, useCallback } from "react";
import type { Config, Data, Layout } from "plotly.js";

type PlotlyApi = typeof import("plotly.js");

interface ChartFigure {
  data?: Data[];
  layout?: Partial<Layout>;
  frames?: Plotly.Frame[];
  config?: Partial<Config>;
}

interface ChartResultProps {
  figure?: unknown;
}

interface SubplotOverlay {
  left: number;
  top: number;
  width: number;
  height: number;
  traceIndices: number[];
  title: string;
  xaKey: string;
  yaKey: string;
}

interface ExpandedSubplot {
  traces: Data[];
  title: string;
  xTitle?: string;
  yTitle?: string;
  xaKey: string;
  yaKey: string;
  layout: any;
}

function parseFigure(figure: unknown): ChartFigure | null {
  if (!figure) return null;
  if (typeof figure === "string") {
    try { return JSON.parse(figure) as ChartFigure; } catch { return null; }
  }
  if (typeof figure === "object") return figure as ChartFigure;
  return null;
}

/** Deep-merge visual axis style without overwriting existing title.text */
function mergeAxisStyle(existing: any, style: any): any {
  const result = { ...style, ...existing };
  if (style.title) {
    const existingTitle = existing?.title ?? {};
    const baseTitle = typeof existingTitle === "string" ? { text: existingTitle } : existingTitle;
    result.title = {
      ...style.title,
      ...baseTitle,
      font: { ...(style.title?.font ?? {}), ...(baseTitle?.font ?? {}) },
    };
  }
  // Force visual overrides
  result.gridcolor    = style.gridcolor;
  result.zerolinecolor= style.zerolinecolor;
  result.linecolor    = style.linecolor;
  result.tickcolor    = style.tickcolor;
  result.showgrid     = style.showgrid;
  result.showline     = style.showline;
  result.mirror       = style.mirror;
  result.automargin   = style.automargin;
  if (style.tickfont) result.tickfont = { ...(existing?.tickfont ?? {}), ...style.tickfont };
  return result;
}

/** Normalise "x" → "xaxis", "x2" → "xaxis2", "xaxis" → "xaxis", etc. */
function normAxis(ref: string | undefined, prefix: "x" | "y"): string {
  if (!ref) return `${prefix}axis`;
  if (ref === prefix) return `${prefix}axis`;
  if (ref.startsWith(`${prefix}axis`)) return ref;
  // "x2", "y3" etc.
  if (ref.startsWith(prefix)) return `${prefix}axis${ref.slice(1)}`;
  return `${prefix}axis`;
}

/** Get subplot title from annotations (make_subplots stores them there) */
function getSubplotTitles(annotations: any[]): Map<string, string> {
  const map = new Map<string, string>();
  annotations.forEach((ann) => {
    if (!ann.text) return;
    // xref like "x domain", "x2 domain", "paper"
    const xref: string = ann.xref ?? "";
    const match = xref.match(/^(x\d*)\s+domain$/);
    if (match) {
      const axisNum = match[1]; // "x", "x2", "x3"…
      const xaKey = normAxis(axisNum, "x");
      map.set(xaKey, ann.text);
    } else if (xref === "paper") {
      // Figure-level title stored as annotation sometimes
      map.set("paper", ann.text);
    }
  });
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expanded modal: renders a single subplot fullscreen
// ─────────────────────────────────────────────────────────────────────────────
function ExpandModal({
  expanded,
  onClose,
}: {
  expanded: ExpandedSubplot;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    let disposed = false;
    async function render() {
      if (!chartRef.current) return;
      const Plotly = (await import("plotly.js/dist/plotly")) as PlotlyApi;
      if (disposed || !chartRef.current) return;

      const BG = "#F3F0EC";
      const AXIS_STYLE: any = {
        gridcolor:    "rgba(0,0,0,0.13)",
        zerolinecolor:"rgba(0,0,0,0.25)",
        linecolor:    "rgba(0,0,0,0.2)",
        tickcolor:    "rgba(0,0,0,0.35)",
        tickfont:     { color: "#1c1c18", size: 12 },
        showgrid:     true,
        showline:     true,
        mirror:       true,
        automargin:   true,
      };

      // Strip traces' xaxis/yaxis assignments so they render on default axes
      const traces = expanded.traces.map((t: any) => {
        const { xaxis: _x, yaxis: _y, ...rest } = t;
        return rest;
      });

      // Pull axis titles from the original layout's axis keys
      const origLayout = expanded.layout ?? {};
      const origXAxis = origLayout[expanded.xaKey] ?? {};
      const origYAxis = origLayout[expanded.yaKey] ?? {};
      const xTitle = typeof origXAxis.title === "string"
        ? origXAxis.title
        : origXAxis.title?.text ?? "";
      const yTitle = typeof origYAxis.title === "string"
        ? origYAxis.title
        : origYAxis.title?.text ?? "";

      const layout: any = {
        title: { text: expanded.title, font: { color: "#1c1c18", size: 18, family: "'Inter', system-ui" } },
        autosize: true,
        height: Math.min(window.innerHeight * 0.72, 520),
        margin: { t: 70, r: 40, b: 70, l: 70 },
        paper_bgcolor: BG,
        plot_bgcolor:  BG,
        font: { family: "'Inter', system-ui, sans-serif", color: "#1c1c18", size: 13 },
        legend: { font: { color: "#1c1c18" }, bgcolor: "rgba(243,240,236,0.8)" },
        xaxis: { ...AXIS_STYLE, title: { text: xTitle, font: { color: "#1c1c18", size: 13 } } },
        yaxis: { ...AXIS_STYLE, title: { text: yTitle, font: { color: "#1c1c18", size: 13 } } },
      };

      await Plotly.newPlot(chartRef.current, traces as Data[], layout, {
        responsive: true,
        displayModeBar: true,
        ...({} as any),
      });
    }
    void render();
    return () => {
      disposed = true;
      import("plotly.js/dist/plotly")
        .then((P) => { if (chartRef.current) P.purge(chartRef.current); })
        .catch(() => {});
    };
  }, [expanded]);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ background: "rgba(28,28,24,0.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        className="relative bg-input-bg rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.22)] border border-sidebar-border/60 overflow-hidden"
        style={{ width: "min(90vw, 860px)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border/50 select-none shrink-0">
          <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {expanded.title || "Chart"}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chart area */}
        <div className="p-4 overflow-auto">
          <div ref={chartRef} className="w-full" />
        </div>

        {/* Footer hint */}
        <div className="px-6 py-2.5 border-t border-sidebar-border/40 shrink-0 select-none">
          <p className="text-[10px] text-on-surface-variant/50 tracking-wide">
            Press <kbd className="font-mono bg-surface-container px-1 rounded text-[9px]">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ChartResult component
// ─────────────────────────────────────────────────────────────────────────────
export default function ChartResult({ figure }: ChartResultProps) {
  const chartRef   = useRef<HTMLDivElement | null>(null);
  const [error,    setError]   = useState<string | null>(null);
  const [rendered, setRendered]= useState(false);
  const [overlays, setOverlays]= useState<SubplotOverlay[]>([]);
  const [hovered,  setHovered] = useState<number | null>(null);
  const [expanded, setExpanded]= useState<ExpandedSubplot | null>(null);
  const [chartDims,setChartDims]= useState<{ w: number; h: number } | null>(null);

  const parsedFigure = parseFigure(figure);
  const chartData    = parsedFigure?.data;

  // Compute clickable overlay positions from Plotly's internal _fullLayout
  const buildOverlays = useCallback((gd: any, data: Data[], origLayout: any) => {
    const fl = gd._fullLayout;
    if (!fl) return;

    const W  = fl.width  as number;
    const H  = fl.height as number;
    const ml = fl.margin?.l ?? 60;
    const mr = fl.margin?.r ?? 30;
    const mt = fl.margin?.t ?? 80;
    const mb = fl.margin?.b ?? 60;
    const plotW = W - ml - mr;
    const plotH = H - mt - mb;

    // Group traces by subplot (xaKey-yaKey pair)
    const subplotMap = new Map<string, number[]>();
    (data as any[]).forEach((trace, idx) => {
      const xaKey = normAxis(trace.xaxis, "x");
      const yaKey = normAxis(trace.yaxis, "y");
      const key = `${xaKey}||${yaKey}`;
      if (!subplotMap.has(key)) subplotMap.set(key, []);
      subplotMap.get(key)!.push(idx);
    });

    // Get subplot titles from annotations
    const annotations = (origLayout?.annotations as any[]) ?? [];
    const titleMap    = getSubplotTitles(annotations);

    const result: SubplotOverlay[] = [];
    subplotMap.forEach((traceIndices, key) => {
      const [xaKey, yaKey] = key.split("||");
      const xa = fl[xaKey];
      const ya = fl[yaKey];
      if (!xa?.domain || !ya?.domain) return;

      const [xd0, xd1] = xa.domain as [number, number];
      const [yd0, yd1] = ya.domain as [number, number];

      // Convert paper-relative domain → pixel offset from div top-left
      const left   = ml + xd0 * plotW;
      const right  = ml + xd1 * plotW;
      const top    = mt + (1 - yd1) * plotH; // y domain is bottom-up
      const bottom = mt + (1 - yd0) * plotH;

      const title = titleMap.get(xaKey) ?? titleMap.get("paper") ?? "";

      result.push({
        left,
        top,
        width:  right  - left,
        height: bottom - top,
        traceIndices,
        title,
        xaKey,
        yaKey,
      });
    });

    setOverlays(result);
  }, []);

  const handleOverlayClick = useCallback((overlay: SubplotOverlay) => {
    if (!chartData || !parsedFigure) return;
    const traces = overlay.traceIndices.map((i) => (chartData as Data[])[i]);
    setExpanded({
      traces,
      title:  overlay.title,
      xaKey:  overlay.xaKey,
      yaKey:  overlay.yaKey,
      layout: parsedFigure.layout,
    });
  }, [chartData, parsedFigure]);

  useEffect(() => {
    let disposed = false;

    async function renderChart() {
      if (!chartRef.current) return;
      if (!parsedFigure || !Array.isArray(chartData) || chartData.length === 0) {
        setError(null); setRendered(false); setOverlays([]); return;
      }

      try {
        setError(null); setRendered(false); setOverlays([]);
        const Plotly = (await import("plotly.js/dist/plotly")) as PlotlyApi;
        if (disposed || !chartRef.current) return;

        const BG_COLOR = "#E9E9E6";
        const AXIS_STYLE: any = {
          gridcolor:    "rgba(0,0,0,0.13)",
          zerolinecolor:"rgba(0,0,0,0.25)",
          linecolor:    "rgba(0,0,0,0.2)",
          tickcolor:    "rgba(0,0,0,0.35)",
          tickfont:     { color: "#1c1c18", size: 11 },
          title:        { font: { color: "#1c1c18", size: 12 } },
          showgrid:     true,
          showline:     true,
          mirror:       true,   // ← draws all 4 sides of the subplot box
          automargin:   true,
        };

        const margin: any = {
          t: 80, r: 30, b: 60, l: 60,
          ...(parsedFigure.layout?.margin ?? {}),
        };
        if (margin.t < 80) margin.t = 80;

        const annotations = (parsedFigure.layout?.annotations as any[] | undefined) ?? [];
        const rawTitle    = parsedFigure.layout?.title;
        const mainTitle   = rawTitle
          ? typeof rawTitle === "string" ? { text: rawTitle } : rawTitle
          : undefined;

        // Use Python-specified dimensions (don't strip them) so subplots render at intended size.
        // Fall back to sensible defaults if Python didn't set them.
        const pythonW = (parsedFigure.layout as any)?.width;
        const pythonH = (parsedFigure.layout as any)?.height;
        const chartW  = Math.max(pythonW ?? 900, 600);   // minimum 600px wide
        const chartH  = Math.max(pythonH ?? 420, 360);   // minimum 360px tall

        const layout: any = {
          ...parsedFigure.layout,   // keep original layout (including width/height from Python)
          autosize: false,          // fixed size — the scroll container handles overflow
          width:    chartW,
          height:   chartH,
          margin,
          paper_bgcolor: BG_COLOR,
          plot_bgcolor:  BG_COLOR,
          font: { family: "'Inter', system-ui, sans-serif", color: "#1c1c18", size: 12, ...(parsedFigure.layout?.font ?? {}) },
          annotations,
          ...(mainTitle ? { title: mainTitle } : {}),
          legend: { font: { color: "#1c1c18", size: 11 }, bgcolor: "rgba(243,240,236,0.85)", bordercolor: "rgba(0,0,0,0.1)", borderwidth: 1 },
        };

        // Apply axis styles to all possible subplot axes (xaxis/yaxis 1-9)
        ["xaxis", "yaxis", ...Array.from({ length: 8 }, (_, i) => [
          `xaxis${i + 2}`, `yaxis${i + 2}`,
        ]).flat()].forEach((key) => {
          layout[key] = mergeAxisStyle(layout[key] ?? {}, AXIS_STYLE);
        });

        await Plotly.newPlot(chartRef.current, chartData, layout, {
          responsive:     false,   // fixed size — scroll container handles overflow
          displayModeBar: false,
          ...parsedFigure.config,
        });

        if (!disposed && chartRef.current) {
          setRendered(true);
          setChartDims({ w: chartW, h: chartH });
          buildOverlays(chartRef.current as any, chartData, parsedFigure.layout);
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Plot rendering failed.");
          setRendered(false);
        }
      }
    }

    void renderChart();

    return () => {
      disposed = true;
      import("plotly.js/dist/plotly")
        .then((P) => { if (chartRef.current) P.purge(chartRef.current); })
        .catch(() => {});
    };
  }, [parsedFigure, chartData, buildOverlays]);

  if (!parsedFigure || !Array.isArray(chartData) || chartData.length === 0) {
    return <p className="text-sm text-gray-400">No chart data</p>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to render chart: {error}
      </div>
    );
  }

  return (
    <>
      {/* Main chart container */}
      <div className="space-y-1">
        {!rendered && (
          <p className="text-sm text-on-surface-variant/60 text-center py-4 animate-pulse">
            Rendering chart…
          </p>
        )}

        {/* Hint text */}
        {rendered && overlays.length > 1 && (
          <p className="text-[10px] text-on-surface-variant/50 text-right pr-1 select-none tracking-wide">
            Click any subplot to expand ↗
          </p>
        )}

        {/*
          Dual-axis scrollable wrapper.
          max-height caps vertical space; inner div is fixed to Python's dimensions.
          Overlays sit inside the fixed-size div so their pixel coords stay correct.
        */}
        <div
          className="w-full overflow-auto rounded-xl border border-sidebar-border/40"
          style={{ maxHeight: 520 }}
        >
          {/* Fixed-size positioning context — matches Plotly's rendered canvas exactly */}
          <div
            className="relative"
            style={{
              width:  chartDims ? chartDims.w : "100%",
              height: chartDims ? chartDims.h : 420,
              minWidth: chartDims ? chartDims.w : "100%",
            }}
          >
            <div ref={chartRef} className="absolute inset-0" />

            {/* Invisible click-capture overlays per subplot */}
            {rendered && overlays.map((ov, i) => (
              <div
                key={i}
                onClick={() => handleOverlayClick(ov)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className="absolute cursor-pointer transition-all duration-150 rounded"
                style={{
                  left:   ov.left,
                  top:    ov.top,
                  width:  ov.width,
                  height: ov.height,
                  background: hovered === i ? "rgba(0,0,0,0.035)" : "transparent",
                  border: hovered === i ? "2px solid rgba(0,0,0,0.16)" : "2px solid transparent",
                  zIndex: 10,
                  borderRadius: 6,
                }}
              >
                {/* Expand icon on hover */}
                {hovered === i && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-md bg-white/90 border border-black/10 flex items-center justify-center shadow-sm">
                    <svg className="w-3.5 h-3.5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint — only shown when content overflows */}
        {rendered && chartDims && (chartDims.w > 900 || chartDims.h > 520) && (
          <p className="text-[10px] text-on-surface-variant/40 text-center select-none tracking-wide mt-0.5">
            ← scroll to see all plots →
          </p>
        )}
      </div>

      {/* Expand modal */}
      {expanded && (
        <ExpandModal expanded={expanded} onClose={() => setExpanded(null)} />
      )}
    </>
  );
}
