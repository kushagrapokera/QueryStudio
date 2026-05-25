interface TableResultProps {
  columns: string[];
  rows: (string | number)[][];
}

function downloadCsv(columns: string[], rows: (string | number)[][]) {
  const header = columns.join(",");
  const body = rows.map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "query_result.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function TableResult({ columns, rows }: TableResultProps) {
  if (!columns.length) {
    return <p className="text-sm text-on-surface-variant/60 italic">Empty result</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between select-none">
        <p className="text-xs text-on-surface-variant font-medium">
          {rows.length} row{rows.length !== 1 ? "s" : ""} returned
        </p>
        <button
          onClick={() => downloadCsv(columns, rows)}
          className="text-xs text-on-surface hover:text-primary transition-all font-semibold flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
          Download CSV
        </button>
      </div>
      <div className="overflow-x-auto border border-sidebar-border rounded-xl bg-surface-bright shadow-[0_4px_12px_rgba(0,0,0,0.01)] no-scrollbar">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest border-b border-sidebar-border select-none">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-sidebar-border last:border-0 hover:bg-surface-container-low/20 transition-colors"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 text-xs text-on-surface whitespace-nowrap truncate max-w-48 font-medium">
                    {cell?.toString() ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
