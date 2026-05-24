import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import QueryEditor from "./components/Editor/QueryEditor";
import ResultRenderer from "./components/Results/ResultRenderer";
import type { Dataset, QueryResult } from "./types";

interface HistoryItem {
  query: string;
  type: string;
  timestamp: number;
}

type Mode = "python" | "sql";

function App() {
  const [mode, setMode] = useState<Mode>("python");
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const handleRun = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);

    const { runPythonQuery } = await import("./api/client");
    try {
      const res = await runPythonQuery({
        dataset_id: activeDataset?.dataset_id ?? "demo",
        query,
      });
      setResult(res);

      setHistory((prev) => [
        { query, type: res.type, timestamp: Date.now() },
        ...prev.slice(0, 49),
      ]);
    } catch (err: unknown) {
      // Extract backend error message from axios response
      let msg = "Request failed";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response: { data: Record<string, unknown>; status: number } };
        const data = axiosErr.response.data;
        msg = (data?.message as string) || (data?.error as string) || `Status ${axiosErr.response.status}`;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      const errResult: QueryResult = { type: "error", message: msg };
      setResult(errResult);

      setHistory((prev) => [
        { query, type: "error", timestamp: Date.now() },
        ...prev.slice(0, 49),
      ]);
    } finally {
      setLoading(false);
    }
  }, [query, activeDataset]);

  const handleHistorySelect = useCallback((q: string) => {
    setQuery(q);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        mode={mode}
        onModeChange={setMode}
        activeDataset={activeDataset}
        onDatasetChange={setActiveDataset}
        queryHistory={history}
        onHistorySelect={handleHistorySelect}
      />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col">
        {/* Mode Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-800">QueryStudio</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            {mode === "python" ? "Python" : "SQL"}
          </span>
        </header>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <QueryEditor
            value={query}
            onChange={setQuery}
            onRun={handleRun}
            loading={loading}
            mode={mode}
          />

          {/* Results Area */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span>Generating and executing...</span>
                </div>
              </div>
            ) : result ? (
              <div className="p-4">
                <ResultRenderer result={result} />
              </div>
            ) : activeDataset ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">Run a query to see results here</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">Upload a dataset to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
