import type { Connection, Dataset } from "../../types";
import FileUpload from "../FileUpload/FileUpload";
import ConnectionManager from "../ConnectionManager/ConnectionManager";
import QueryHistory from "./QueryHistory";
import SchemaBrowser from "./SchemaBrowser";

interface HistoryItem {
  query: string;
  type: string;
  timestamp: number;
}

interface SidebarProps {
  mode: "python" | "sql";
  onModeChange: (mode: "python" | "sql") => void;
  activeDataset: Dataset | null;
  onDatasetChange: (ds: Dataset | null) => void;
  activeConnection: Connection | null;
  onConnectionChange: (conn: Connection | null) => void;
  queryHistory: HistoryItem[];
  onHistorySelect: (query: string) => void;
}

export default function Sidebar({
  mode,
  onModeChange,
  activeDataset,
  onDatasetChange,
  activeConnection,
  onConnectionChange,
  queryHistory,
  onHistorySelect,
}: SidebarProps) {
  return (
    <aside className="w-sidebar-width h-full bg-sidebar-bg border-r border-sidebar-border flex flex-col shrink-0 z-20 select-none">
      <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto no-scrollbar">
        {/* Header Branding */}
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: "24px" }}>grid_view</span>
          <h1 className="font-playfair text-2xl font-bold tracking-tight text-on-surface">QueryStudio</h1>
        </div>

        {/* Mode switcher segmented control */}
        <div className="flex bg-surface-container p-1 rounded-xl mb-2 shrink-0 border border-sidebar-border/60">
          <button
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              mode === "python"
                ? "bg-surface-bright shadow-sm text-on-surface font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            onClick={() => onModeChange("python")}
          >
            Python
          </button>
          <button
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              mode === "sql"
                ? "bg-surface-bright shadow-sm text-on-surface font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            onClick={() => onModeChange("sql")}
          >
            SQL
          </button>
        </div>

        {/* File Upload (Python mode) */}
        {mode === "python" && (
          <div className="space-y-3">
            <FileUpload
              activeDataset={activeDataset}
              onDatasetChange={onDatasetChange}
            />
          </div>
        )}

        {/* SQL Connection Manager (SQL mode) */}
        {mode === "sql" && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Database Connection</div>
            <ConnectionManager
              activeConnection={activeConnection}
              onConnectionChange={onConnectionChange}
            />
          </div>
        )}

        {/* Schema Browser (SQL mode, when connection active) */}
        {mode === "sql" && activeConnection && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Schema</div>
            <SchemaBrowser connection={activeConnection} />
          </div>
        )}

        {/* Query History footer section */}
        <div className="mt-auto pt-4 shrink-0">
          <hr className="border-sidebar-border mb-4" />
          <div className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">History</div>
          <QueryHistory
            history={queryHistory}
            onSelect={onHistorySelect}
          />
        </div>
      </div>
    </aside>
  );
}
