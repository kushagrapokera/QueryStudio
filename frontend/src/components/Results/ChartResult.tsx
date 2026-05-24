import { useEffect, useRef, useState } from "react";
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

function parseFigure(figure: unknown): ChartFigure | null {
  if (!figure) {
    return null;
  }

  if (typeof figure === "string") {
    try {
      return JSON.parse(figure) as ChartFigure;
    } catch {
      return null;
    }
  }

  if (typeof figure === "object") {
    return figure as ChartFigure;
  }

  return null;
}

export default function ChartResult({ figure }: ChartResultProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  const parsedFigure = parseFigure(figure);
  const chartData = parsedFigure?.data;

  useEffect(() => {
    let disposed = false;

    async function renderChart() {
      if (!chartRef.current) {
        return;
      }

      if (!parsedFigure || !Array.isArray(chartData) || chartData.length === 0) {
        setError(null);
        setRendered(false);
        return;
      }

      try {
        setError(null);
        setRendered(false);
        const Plotly = (await import("plotly.js/dist/plotly")) as PlotlyApi;

        if (disposed || !chartRef.current) {
          return;
        }

        await Plotly.newPlot(
          chartRef.current,
          chartData,
          {
            ...parsedFigure.layout,
            autosize: true,
            height: 450,
            margin: { t: 20, r: 20, b: 40, l: 60, ...(parsedFigure.layout?.margin ?? {}) },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { family: "system-ui, sans-serif", ...(parsedFigure.layout?.font ?? {}) },
          },
          {
            responsive: true,
            displayModeBar: false,
            ...parsedFigure.config,
          }
        );

        if (!disposed) {
          setRendered(true);
          window.dispatchEvent(new Event("resize"));
        }
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : "Plot rendering failed.";
          setError(message);
          setRendered(false);
        }
      }
    }

    void renderChart();

    return () => {
      disposed = true;
      void import("plotly.js/dist/plotly")
        .then((Plotly) => {
          if (chartRef.current) {
            Plotly.purge(chartRef.current);
          }
        })
        .catch(() => undefined);
    };
  }, [parsedFigure, chartData]);

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
    <div className="space-y-2">
      {!rendered && (
        <p className="text-sm text-gray-400">Rendering chart...</p>
      )}
      <div ref={chartRef} className="w-full" style={{ minHeight: 450, height: 450 }} />
    </div>
  );
}
