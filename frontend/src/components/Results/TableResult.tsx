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
    return <p className="text-sm text-gray-400">Empty result</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => downloadCsv(columns, rows)}
          className="text-xs text-gray-400 hover:text-purple-600 transition"
        >
          Download CSV
        </button>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-medium text-gray-600 text-xs uppercase tracking-wider"
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
                className="border-b border-gray-100 hover:bg-gray-50 transition"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-gray-700">
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
