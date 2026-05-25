import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import ResultRenderer from "./components/Results/ResultRenderer";
import type { Connection, Dataset, QueryResult, SqlQueryResult } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarHistoryItem {
  query: string;
  type: string;
  timestamp: number;
}

/** One completed query+result pair shown as a notebook cell */
interface QueryCell {
  id: number;
  query: string;
  result: QueryResult | SqlQueryResult;
  compact: boolean; // true = show only the NL question, hide execution output
}

type Mode = "python" | "sql";
type Theme = "light" | "dark";

// ─── CodeBlock (lives here so it can sit below the NL query) ─────────────────

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-on-surface-variant hover:text-primary transition-colors font-semibold flex items-center gap-1.5 cursor-pointer py-1 select-none"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {open ? "Hide" : "Show"} generated {label}
      </button>
      {open && (
        <pre className="mt-2 bg-[#1e1e2e] text-[#cdd6f4] p-4 rounded-xl text-xs overflow-x-auto font-mono select-text shadow-sm border border-black/10 whitespace-pre-wrap break-words">
          {code}
        </pre>
      )}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [mode, setMode] = useState<Mode>("python");
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const storedTheme = window.localStorage.getItem("query-studio-theme");
    return storedTheme === "dark" ? "dark" : "light";
  });
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);

  // The current value of the text input (cleared after each submission)
  const [query, setQuery] = useState("");

  // All completed cells (persist across queries)
  const [cells, setCells] = useState<QueryCell[]>([]);

  // The query currently being executed (shown as a loading cell)
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sidebar history (separate from cells — sidebar just shows labels)
  const [sidebarHistory, setSidebarHistory] = useState<SidebarHistoryItem[]>([]);

  const nextId = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const tx = textareaRef.current;
    if (tx) {
      tx.style.height = "auto";
      tx.style.height = `${Math.min(tx.scrollHeight, 200)}px`;
    }
  }, [query]);

  // Scroll to bottom whenever a new cell is added or loading starts
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cells.length, loading]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("query-studio-theme", theme);
  }, [theme]);

  const pushSidebarHistory = useCallback((q: string, type: string) => {
    setSidebarHistory((prev) => [
      { query: q, type, timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // ── Core run logic ──────────────────────────────────────────────────────────

  const handleRun = useCallback(async (customQuery?: string) => {
    const targetQuery = (customQuery ?? query).trim();
    if (!targetQuery) return;
    if (mode === "sql" && !activeConnection) return;

    // Optimistic UI: clear input, show loading cell immediately
    setQuery("");
    setLoading(true);
    setPendingQuery(targetQuery);

    try {
      let res: QueryResult | SqlQueryResult;

      if (mode === "python") {
        const { runPythonQuery } = await import("./api/client");
        res = await runPythonQuery({
          dataset_id: activeDataset?.dataset_id ?? "demo",
          query: targetQuery,
        });
      } else {
        const { runSqlQuery } = await import("./api/client");
        res = await runSqlQuery(activeConnection!.id, {
          query: targetQuery,
          timeout: 30,
        });
      }

      const id = nextId.current++;
      setCells((prev) => [...prev, { id, query: targetQuery, result: res, compact: false }]);
      pushSidebarHistory(targetQuery, res.type);
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
      const id = nextId.current++;
      setCells((prev) => [...prev, { id, query: targetQuery, result: errResult, compact: false }]);
      pushSidebarHistory(targetQuery, "error");
    } finally {
      setLoading(false);
      setPendingQuery(null);
    }
  }, [query, mode, activeDataset, activeConnection, pushSidebarHistory]);

  // Toggle compact/expanded for an individual cell
  const toggleCompact = useCallback((id: number) => {
    setCells((prev) =>
      prev.map((c) => (c.id === id ? { ...c, compact: !c.compact } : c))
    );
  }, []);

  const handleHistorySelect = useCallback((q: string) => {
    setQuery(q);
    textareaRef.current?.focus();
  }, []);

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode);
    setCells([]);
    setPendingQuery(null);
    setQuery("");
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleRun();
    }
  };

  const workspaceName = activeDataset
    ? activeDataset.filename
    : activeConnection
    ? activeConnection.label
    : "data-workspace";

  const isActive = cells.length > 0 || loading;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div data-theme={theme} className="flex h-screen w-full font-body-md text-on-surface bg-surface overflow-hidden">
      {/* Navigation Sidebar */}
      <Sidebar
        mode={mode}
        onModeChange={handleModeChange}
        activeDataset={activeDataset}
        onDatasetChange={setActiveDataset}
        activeConnection={activeConnection}
        onConnectionChange={setActiveConnection}
        queryHistory={sidebarHistory}
        onHistorySelect={handleHistorySelect}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 flex flex-col h-full main-canvas relative overflow-hidden">

        {/* Top Header Bar */}
        <header className="theme-header h-16 px-8 flex items-center justify-between w-full border-b border-outline-variant z-10 select-none">
          <div className="flex items-center gap-4">
            <h1 className="font-playfair text-lg text-on-surface">
              QueryStudio / <span className="text-primary font-bold">{workspaceName}</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme((currentTheme) => currentTheme === "light" ? "dark" : "light")}
              className="theme-top-action px-4 py-1.5 rounded-full border border-outline-variant text-nav-item transition-colors cursor-pointer flex items-center gap-2 text-xs font-semibold"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                {theme === "light" ? "dark_mode" : "light_mode"}
              </span>
              {theme === "light" ? "Dark" : "Light"}
            </button>
            <button className="theme-top-action px-4 py-1.5 rounded-full border border-outline-variant text-nav-item transition-colors cursor-pointer flex items-center gap-2 text-xs font-semibold">
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>share</span>
              Share
            </button>
            <div className="theme-avatar w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-sidebar-border text-on-secondary-fixed select-none">
              F
            </div>
          </div>
        </header>

        {/* Dynamic Work Area — scrollable */}
        <div className={`flex-1 flex flex-col items-center justify-start overflow-y-auto px-6 py-8 no-scrollbar relative z-10 ${isActive ? "pb-6" : "pb-8"}`}>

          {!isActive ? (
            /* ── Landing State ─────────────────────────────────────────────── */
            <div className="w-full max-w-workspace-max-width flex flex-col items-center justify-center my-auto">
              <div className="text-center mb-12 select-none relative z-10">
                <h2 className="font-display-hero text-display-hero text-on-surface leading-tight">
                  <span className="font-semibold">What can I help you with today?</span>
                </h2>
              </div>

              {/* Landing chat box */}
              <div className="w-full relative group">
                <div className="premium-chatbox p-6 relative z-10">
                  <textarea
                    ref={textareaRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent border-none focus:ring-0 resize-none font-body-lg text-body-lg placeholder-on-secondary-container/50 text-on-surface focus:outline-none outline-none outline-0"
                    placeholder={
                      mode === "python"
                        ? "Ask anything about your CSV/Excel data..."
                        : "Ask a question about database in plain English..."
                    }
                    rows={2}
                  />
                  <div className="flex items-center justify-end mt-6 pt-4 border-t border-input-border/50">
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-secondary-container hover:text-on-surface transition-colors cursor-pointer">
                        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>mic</span>
                      </button>
                      <button
                        onClick={() => void handleRun()}
                        disabled={!query.trim()}
                        className="theme-send-button w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_upward</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          ) : (
            /* ── Active: stacked cells + loading + input ───────────────────── */
            <div className="w-full max-w-4xl flex flex-col gap-4 select-text">

              {/* ── Completed cells ── */}
              {cells.map((cell) => {
                // Pull generated code/SQL out of the result (shown in question section)
                const genCode = "_generated_code" in cell.result
                  ? (cell.result as QueryResult)._generated_code
                  : undefined;
                const genSql = "_generated_sql" in cell.result
                  ? (cell.result as { _generated_sql?: string })._generated_sql
                  : undefined;

                return (
                  <div
                    key={cell.id}
                    className="theme-result-card rounded-2xl border border-sidebar-border/60 transition-all duration-500"
                  >
                    {/* ── Question section ── */}
                    <div className="p-5 flex flex-col gap-2">
                      <div className="flex items-center justify-between select-none">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: "17px" }}>psychology</span>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Natural Language Question</span>
                        </div>
                        {/* Compact / Expand toggle */}
                        <button
                          onClick={() => toggleCompact(cell.id)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-on-surface-variant hover:text-primary transition-colors cursor-pointer select-none px-2 py-1 rounded-md hover:bg-surface-container-low"
                        >
                          {cell.compact ? (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>expand_more</span>
                              Expand
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>expand_less</span>
                              Compact
                            </>
                          )}
                        </button>
                      </div>

                      {/* Query text */}
                      <div className="text-base md:text-lg font-playfair font-semibold text-on-surface px-0.5 leading-snug">
                        "{cell.query}"
                      </div>

                      {/* Generated code — sits directly below the query */}
                      {(genCode || genSql) && (
                        <CodeBlock
                          code={genCode ?? genSql ?? ""}
                          label={genCode ? "code" : "SQL"}
                        />
                      )}
                    </div>

                    {/* ── Execution output (hidden when compact) ── */}
                    {!cell.compact && (
                      <>
                        <hr className="border-sidebar-border/60" />
                        <div className="p-5 flex flex-col gap-3">
                          <div className="flex items-center justify-between select-none">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-primary" style={{ fontSize: "17px" }}>terminal</span>
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Execution Pipeline Output</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider">Compiled Output</span>
                            </div>
                          </div>
                          <ResultRenderer result={cell.result} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* ── Loading cell ── */}
              {loading && pendingQuery && (
                <div className="theme-result-card rounded-2xl border border-sidebar-border/60">
                  {/* Question section */}
                  <div className="p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 select-none">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: "17px" }}>psychology</span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Natural Language Question</span>
                    </div>
                    <div className="text-base md:text-lg font-playfair font-semibold text-on-surface px-0.5 leading-snug">
                      "{pendingQuery}"
                    </div>
                  </div>
                  <hr className="border-sidebar-border/60" />
                  {/* Loading spinner */}
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 select-none">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: "17px" }}>terminal</span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Execution Pipeline Output</span>
                    </div>
                    <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant">
                      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-sm font-medium">
                        {mode === "python"
                          ? "Generating and executing in sandbox…"
                          : "Translating to SQL and querying connection…"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scroll anchor — sits above the end of the list */}
              <div ref={bottomRef} className="h-2" />

            </div>
          )}

        </div>

        {/* ── Fixed footer input (outside scroll area, so it never overlaps content) ── */}
        {isActive && (
          <div className="theme-footer-bar shrink-0 px-6 pb-5 pt-3 border-t border-sidebar-border/40 z-20">
            <div className="w-full max-w-4xl mx-auto relative group">
              <div className="premium-footer-chatbox px-4 py-3 flex items-end gap-3 relative z-10">
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none font-body-md placeholder-on-secondary-container/40 text-on-surface focus:outline-none outline-none outline-0 py-1 max-h-[160px] relative z-10"
                  placeholder="Ask a new question or follow-up…"
                  rows={1}
                />
                <button
                  onClick={() => void handleRun()}
                  disabled={loading || !query.trim()}
                  className="theme-send-button w-8 h-8 flex items-center justify-center rounded-full active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed shadow mb-0.5 relative z-10"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_upward</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Decorative ambient elements */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 pointer-events-none opacity-40 z-0 select-none">
          <div className="text-[10px] tracking-[0.2em] uppercase text-on-tertiary-container font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            System Online
          </div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-on-tertiary-container font-bold">
            v4.82.0 Professional
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
          <div className="canvas-ambient-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full" />
        </div>

      </main>
    </div>
  );
}

export default App;
