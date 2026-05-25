import { useState, useMemo } from "react";
import type { QueryResult, SqlQueryResult } from "../../types";
import TableResult from "./TableResult";
import ChartResult from "./ChartResult";
import ErrorResult from "./ErrorResult";

interface ResultRendererProps {
  result: QueryResult | SqlQueryResult;
}

const TEXT_TRUNCATE_LINES = 40;

function TextResult({ content }: { content?: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => (content ?? "").split("\n"), [content]);
  const isLong = lines.length > TEXT_TRUNCATE_LINES;
  const displayLines = expanded ? lines : lines.slice(0, TEXT_TRUNCATE_LINES);

  if (!content) {
    return <p className="text-sm text-gray-400">Empty result</p>;
  }

  return (
    <div>
      <pre className="bg-surface-container-low p-4 rounded-xl text-sm whitespace-pre-wrap font-mono text-on-surface/80 overflow-x-auto border border-sidebar-border/40">
        {displayLines.join("\n")}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          {expanded ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

export default function ResultRenderer({ result }: ResultRendererProps) {
  return (
    <div className="space-y-3">
      {result.type === "table" && (
        <TableResult columns={result.columns ?? []} rows={(result.rows ?? []) as (string | number)[][]} />
      )}
      {result.type === "chart" && <ChartResult figure={(result as { figure?: unknown }).figure} />}
      {result.type === "error" && (
        <ErrorResult
          ename={result.ename}
          message={result.message || ("error" in result ? (result.error as string) : undefined)}
        />
      )}
      {result.type === "text" && <TextResult content={result.content} />}
    </div>
  );
}
