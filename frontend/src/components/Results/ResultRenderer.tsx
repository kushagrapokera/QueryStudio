import { useState, useMemo } from "react";
import type { QueryResult } from "../../types";
import TableResult from "./TableResult";
import ChartResult from "./ChartResult";
import ErrorResult from "./ErrorResult";

interface ResultRendererProps {
  result: QueryResult;
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
      <pre className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono text-gray-700 overflow-x-auto">
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
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="space-y-3">
      {/* Main result */}
      {result.type === "table" && (
        <TableResult columns={result.columns ?? []} rows={result.rows ?? []} />
      )}
      {result.type === "chart" && <ChartResult figure={result.figure} />}
      {result.type === "error" && (
        <ErrorResult ename={result.ename} message={result.message} />
      )}
      {result.type === "text" && <TextResult content={result.content} />}

      {/* Show generated code toggle */}
      {result._generated_code && (
        <div>
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition ${showCode ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {showCode ? "Hide" : "Show"} generated code
          </button>
          {showCode && (
            <pre className="mt-2 bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
              {result._generated_code}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
