import type { Dataset } from "../../types";
import FileUpload from "../FileUpload/FileUpload";
import QueryHistory from "./QueryHistory";

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
  queryHistory: HistoryItem[];
  onHistorySelect: (query: string) => void;
}

export default function Sidebar({
  mode,
  onModeChange,
  activeDataset,
  onDatasetChange,
  queryHistory,
  onHistorySelect,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Mode Switcher */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
          <button
            className={`flex-1 py-1.5 rounded-md font-medium transition ${
              mode === "python"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => onModeChange("python")}
          >
            Python
          </button>
          <button
            className={`flex-1 py-1.5 rounded-md font-medium transition ${
              mode === "sql"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => onModeChange("sql")}
          >
            SQL
          </button>
        </div>
      </div>

      {/* File Upload (Python mode) */}
      {mode === "python" && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Dataset
          </h3>
          <FileUpload
            activeDataset={activeDataset}
            onDatasetChange={onDatasetChange}
          />
        </div>
      )}

      {/* SQL Connection (placeholder for Phase 2) */}
      {mode === "sql" && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Database
          </h3>
          <p className="text-xs text-gray-400">
            SQL connections will be available in Phase 2.
          </p>
        </div>
      )}

      {/* Query History */}
      <div className="p-4 flex-1 overflow-hidden flex flex-col">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          History
        </h3>
        <div className="flex-1 overflow-hidden">
          <QueryHistory
            history={queryHistory}
            onSelect={onHistorySelect}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">QueryStudio v0.1</p>
      </div>
    </aside>
  );
}
