import { useState, useCallback } from "react";
import { uploadFile } from "../../api/client";
import type { Dataset } from "../../types";
import DatasetProfile from "./DatasetProfile";

interface FileUploadProps {
  activeDataset: Dataset | null;
  onDatasetChange: (ds: Dataset | null) => void;
}

export default function FileUpload({
  activeDataset,
  onDatasetChange,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
        alert("Only CSV and Excel (.xlsx, .xls) files are supported");
        return;
      }

      setUploading(true);
      try {
        const ds = await uploadFile(file);
        onDatasetChange(ds);
        setExpanded(true);
      } catch {
        alert("Upload failed. Check the backend is running.");
      } finally {
        setUploading(false);
      }
    },
    [onDatasetChange]
  );

  return (
    <div>
      {activeDataset ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">
                {activeDataset.filename}
              </p>
              <p className="text-xs text-gray-400">
                ID: {activeDataset.dataset_id}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-gray-400 hover:text-gray-600 transition p-1"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
              <button
                onClick={() => onDatasetChange(null)}
                className="text-xs text-gray-400 hover:text-red-500 transition"
              >
                Remove
              </button>
            </div>
          </div>

          {expanded && activeDataset.profile && (
            <DatasetProfile profile={activeDataset.profile} />
          )}
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-purple-400 transition">
          <span className="text-xs text-gray-500 mb-1">
            {uploading ? "Uploading..." : "Upload CSV or Excel"}
          </span>
          <span className="text-xs text-gray-400">Click to browse</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
