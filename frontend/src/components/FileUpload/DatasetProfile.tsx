import type { DatasetProfile as Profile } from "../../types";

interface DatasetProfileProps {
  profile: Profile;
}

export default function DatasetProfile({ profile }: DatasetProfileProps) {
  const { columns, dtypes, shape, sample_rows, numeric_stats } = profile;
  const [rows, cols] = shape;

  return (
    <div className="text-xs text-gray-600 space-y-2">
      {/* Shape */}
      <div className="bg-gray-50 rounded px-2 py-1.5">
        <span className="font-medium text-gray-700">{rows}</span> rows ×{" "}
        <span className="font-medium text-gray-700">{cols}</span> columns
      </div>

      {/* Columns & Types */}
      <div>
        <p className="font-medium text-gray-700 mb-1">Columns</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-1.5 py-1 text-left font-medium text-gray-500 border-b border-gray-200">Column</th>
                <th className="px-1.5 py-1 text-left font-medium text-gray-500 border-b border-gray-200">Type</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col} className="border-b border-gray-100">
                  <td className="px-1.5 py-1 text-gray-800 whitespace-nowrap">{col}</td>
                  <td className="px-1.5 py-1 text-gray-400">{dtypes[col]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Numeric Stats */}
      {Object.keys(numeric_stats).length > 0 && (
        <div>
          <p className="font-medium text-gray-700 mb-1">Numeric Stats</p>
          {Object.entries(numeric_stats).map(([col, stats]) => (
            <div key={col} className="bg-gray-50 rounded px-2 py-1 mb-1">
              <p className="text-gray-800 font-medium">{col}</p>
              <div className="flex gap-3 text-gray-500">
                <span>Min: {stats.min}</span>
                <span>Max: {stats.max}</span>
                <span>Mean: {stats.mean}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sample Rows */}
      {sample_rows.length > 0 && (
        <div>
          <p className="font-medium text-gray-700 mb-1">Sample (first {sample_rows.length} rows)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-1.5 py-1 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample_rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-1.5 py-1 text-gray-700 whitespace-nowrap truncate max-w-24"
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
      )}
    </div>
  );
}
