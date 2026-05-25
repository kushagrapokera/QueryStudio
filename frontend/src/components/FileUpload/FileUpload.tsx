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
          <div className="text-[11px] font-bold tracking-wider text-on-surface-variant mb-4 uppercase select-none">Dataset</div>
          
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm text-on-surface truncate pr-2 max-w-[170px]" title={activeDataset.filename}>
              {activeDataset.filename}
            </span>
            <div className="flex gap-3 text-xs text-on-surface-variant shrink-0 select-none">
              <button
                onClick={() => setExpanded(!expanded)}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
              <button
                onClick={() => onDatasetChange(null)}
                className="hover:text-red-500 transition-colors cursor-pointer font-medium"
              >
                Remove
              </button>
            </div>
          </div>
          
          <div className="text-xs text-on-surface-variant mb-4 select-none">ID: {activeDataset.dataset_id.slice(0, 8)}</div>

          {expanded && activeDataset.profile && (
            <DatasetProfile profile={activeDataset.profile} />
          )}
        </div>
      ) : (
        <div>
          <div className="text-[11px] font-bold tracking-wider text-on-surface-variant mb-4 uppercase select-none">Dataset</div>
          
          <label className="flex flex-col items-center justify-center border border-dashed border-sidebar-border bg-surface-bright/60 hover:bg-surface-bright rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-all select-none group">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors mb-2" style={{ fontSize: "28px" }}>cloud_upload</span>
            <span className="text-xs font-semibold text-on-surface mb-1">
              {uploading ? "Uploading dataset..." : "Upload CSV or Excel"}
            </span>
            <span className="text-[10px] text-on-surface-variant">Click to choose a file</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      )}
    </div>
  );
}
