import { useState, useEffect, useCallback } from "react";
import type { Connection, SchemaTable } from "../../types";
import { getSchema } from "../../api/client";

interface SchemaBrowserProps {
  connection: Connection;
}

function TableRow({ table }: { table: SchemaTable }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-md">
      {/* Table header - clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition text-left"
      >
        <svg
          className={`w-3 h-3 text-gray-400 transition shrink-0 ${
            expanded ? "rotate-90" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-sm font-medium text-gray-800 truncate flex-1">
          {table.name}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
          {table.type === "VIEW" ? "VIEW" : `${table.estimated_rows} rows`}
        </span>
        {table.primary_key.length > 0 && (
          <svg
            className="w-3 h-3 text-amber-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Has primary key</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        )}
      </button>

      {/* Expanded columns */}
      {expanded && (
        <div className="border-t border-gray-200">
          {table.columns.length === 0 ? (
            <p className="px-4 py-2 text-xs text-gray-400">No columns</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">
                    Column
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">
                    Type
                  </th>
                  <th className="px-3 py-1.5 text-center font-medium text-gray-500 w-8">
                    PK
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">
                    FK
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((col) => {
                  const isPk = table.primary_key.includes(col.name);
                  const fks = table.foreign_keys.filter(
                    (fk) => fk.column === col.name
                  );
                  return (
                    <tr
                      key={col.name}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-1.5 text-gray-800 font-medium whitespace-nowrap">
                        {col.name}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                        {col.type}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {isPk && (
                          <svg
                            className="w-3 h-3 text-amber-500 mx-auto"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-blue-600 text-[10px] whitespace-nowrap">
                        {fks.length > 0
                          ? fks.map((fk) => (
                              <span key={`${fk.references_table}.${fk.references_column}`}>
                                → {fk.references_table}.{fk.references_column}
                              </span>
                            ))
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Sample rows */}
          {table.sample_rows.length > 0 && (
            <details className="border-t border-gray-200">
              <summary className="px-3 py-1.5 text-[10px] text-gray-500 cursor-pointer hover:bg-gray-50 font-medium">
                Sample rows ({table.sample_rows.length})
              </summary>
              <div className="overflow-x-auto p-2">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      {table.columns.map((col) => (
                        <th
                          key={col.name}
                          className="px-1.5 py-1 text-left font-medium text-gray-500 whitespace-nowrap"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.sample_rows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="px-1.5 py-1 text-gray-600 whitespace-nowrap truncate max-w-20"
                          >
                            {cell?.toString() ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchemaBrowser({ connection }: SchemaBrowserProps) {
  const [schema, setSchema] = useState<{
    database: string;
    tables: SchemaTable[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSchema(connection.id);
      setSchema({ database: data.database, tables: data.tables });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load schema";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [connection.id]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading schema...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-2">
        <p className="text-xs text-red-600 mb-1">Failed to load schema</p>
        <button
          onClick={loadSchema}
          className="text-xs text-blue-600 hover:text-blue-800 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!schema || schema.tables.length === 0) {
    return <p className="text-xs text-gray-400 py-2">No tables found</p>;
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-600">{schema.database}</h4>
        <span className="text-[10px] text-gray-400">
          {schema.tables.length} table{schema.tables.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table list */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {schema.tables.map((table) => (
          <TableRow key={table.name} table={table} />
        ))}
      </div>
    </div>
  );
}
