import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import QueryEditor from "./components/Editor/QueryEditor";
import ResultRenderer from "./components/Results/ResultRenderer";
import type { Connection, Dataset, QueryResult, SqlQueryResult } from "./types";

interface HistoryItem {
  query: string;
  type: string;
  timestamp: number;
}

type Mode = "python" | "sql";

function App() {
  const [mode, setMode] = useState<Mode>("python");
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | SqlQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const addHistory = useCallback((q: string, type: string) => {
    setHistory((prev) => [
      { query: q, type, timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const handleRunPython = useCallback(async () => {
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
      addHistory(query, res.type);
    } catch (err: unknown) {
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
      addHistory(query, "error");
    } finally {
      setLoading(false);
    }
  }, [query, activeDataset, addHistory]);

  const handleRunSql = useCallback(async () => {
    if (!query.trim() || !activeConnection) return;
    setLoading(true);
    setResult(null);

    const { runSqlQuery } = await import("./api/client");
    try {
      const res = await runSqlQuery(activeConnection.id, {
        query,
        timeout: 30,
      });
      setResult(res);
      addHistory(query, res.type);
    } catch (err: unknown) {
      let msg = "Request failed";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response: { data: Record<string, unknown>; status: number } };
        const data = axiosErr.response.data;
        msg = (data?.message as string) || (data?.error as string) || `Status ${axiosErr.response.status}`;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      const errResult: SqlQueryResult = { type: "error", error: msg };
      setResult(errResult);
      addHistory(query, "error");
    } finally {
      setLoading(false);
    }
  }, [query, activeConnection, addHistory]);

  const handleRun = useCallback(() => {
    if (mode === "python") {
      handleRunPython();
    } else {
      handleRunSql();
    }
  }, [mode, handleRunPython, handleRunSql]);

  const handleHistorySelect = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode);
    setResult(null);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        mode={mode}
        onModeChange={handleModeChange}
        activeDataset={activeDataset}
        onDatasetChange={setActiveDataset}
        activeConnection={activeConnection}
        onConnectionChange={setActiveConnection}
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
          {mode === "sql" && activeConnection && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium truncate max-w-40">
              {activeConnection.label}
            </span>
          )}
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
                  <span>
                    {mode === "python"
                      ? "Generating and executing..."
                      : "Generating SQL and executing..."}
                  </span>
                </div>
              </div>
            ) : result ? (
              <div className="p-4">
                <ResultRenderer result={result} />
              </div>
            ) : mode === "python" && activeDataset ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">Run a query to see results here</p>
              </div>
            ) : mode === "sql" && activeConnection ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">Ask a natural language question about your database</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">
                  {mode === "python"
                    ? "Upload a dataset to get started"
                    : "Connect to a database to get started"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
