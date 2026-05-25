import type { DatasetProfile as Profile } from "../../types";

interface DatasetProfileProps {
  profile: Profile;
}

export default function DatasetProfile({ profile }: DatasetProfileProps) {
  const { columns, dtypes, shape, sample_rows, numeric_stats } = profile;
  const [rows, cols] = shape;

  return (
    <div className="space-y-6 text-on-surface">
      {/* Shape Pill */}
      <div className="bg-surface-container-low px-3 py-2 rounded-lg text-xs text-on-secondary-container/80 mb-6 select-none font-medium">
        {rows} rows × {cols} columns
      </div>

      {/* Columns & Types list */}
      <div>
        <div className="text-[13px] font-semibold text-on-surface mb-3">Columns</div>
        <div className="bg-surface-bright rounded-xl border border-sidebar-border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-sidebar-border bg-surface-container-lowest">
                <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Column</th>
                <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Type</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col} className="border-b border-sidebar-border last:border-0">
                  <td className="px-3 py-2 text-xs text-on-surface font-medium">{col}</td>
                  <td className="px-3 py-2 text-xs text-on-surface-variant">{dtypes[col] || "any"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Numeric Stats Cards */}
      {Object.keys(numeric_stats).length > 0 && (
        <div>
          <div className="text-[13px] font-semibold text-on-surface mb-3">Numeric Stats</div>
          <div className="space-y-3">
            {Object.entries(numeric_stats).map(([col, stats]) => (
              <div key={col} className="bg-surface-container rounded-xl p-4 border border-sidebar-border/30">
                <div className="text-xs font-bold mb-3 text-on-surface">{col}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Min:</div>
                    <div className="text-xs text-on-surface mt-0.5">{stats.min !== undefined ? stats.min.toLocaleString() : "-"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Max:</div>
                    <div className="text-xs text-on-surface mt-0.5">{stats.max !== undefined ? stats.max.toLocaleString() : "-"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Mean:</div>
                    <div className="text-xs text-on-surface mt-0.5">
                      {stats.mean !== undefined ? Number(stats.mean.toFixed(2)).toLocaleString() : "-"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Rows Preview */}
      {sample_rows.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold text-on-surface mb-3">Sample (first {sample_rows.length} rows)</div>
          <div className="bg-surface-bright rounded-xl border border-sidebar-border overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sidebar-border bg-surface-container-lowest">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample_rows.map((row, i) => (
                    <tr key={i} className="border-b border-sidebar-border last:border-0 hover:bg-surface-container-low/20 transition-colors">
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-3 py-2 text-xs text-on-surface whitespace-nowrap truncate max-w-28"
                        >
                          {cell?.toString() ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
