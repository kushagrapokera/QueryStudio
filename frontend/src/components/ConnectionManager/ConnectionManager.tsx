import { useState, useCallback, useEffect } from "react";
import type { Connection, ConnectionType } from "../../types";
import {
  createConnection,
  listConnections,
  deleteConnection,
} from "../../api/client";

interface ConnectionManagerProps {
  activeConnection: Connection | null;
  onConnectionChange: (conn: Connection | null) => void;
}

export default function ConnectionManager({
  activeConnection,
  onConnectionChange,
}: ConnectionManagerProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [connType, setConnType] = useState<ConnectionType>("direct");
  const [dbType, setDbType] = useState<"mysql" | "postgres">("mysql");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3306");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("root");
  const [password, setPassword] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpApiKey, setMcpApiKey] = useState("");

  // Load existing connections on mount
  useEffect(() => {
    listConnections()
      .then(setConnections)
      .catch(() => {});
  }, []);

  const resetForm = useCallback(() => {
    setLabel("");
    setConnType("direct");
    setDbType("mysql");
    setHost("localhost");
    setPort("3306");
    setDatabase("");
    setUser("root");
    setPassword("");
    setMcpUrl("");
    setMcpApiKey("");
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const params =
        connType === "direct"
          ? { db_type: dbType, host, port: parseInt(port), database, user, password }
          : { url: mcpUrl, api_key: mcpApiKey || undefined };

      const conn = await createConnection({
        type: connType,
        label: label || undefined,
        params: params as never,
      });
      onConnectionChange(conn);
      setConnections((prev) => {
        const idx = prev.findIndex((c) => c.id === conn.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = conn;
          return updated;
        }
        return [...prev, conn];
      });
      setShowForm(false);
      resetForm();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save connection";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [connType, dbType, host, port, database, user, password, mcpUrl, mcpApiKey, label, onConnectionChange, resetForm]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteConnection(id);
        if (activeConnection?.id === id) {
          onConnectionChange(null);
        }
        setConnections((prev) => prev.filter((c) => c.id !== id));
      } catch {
        setError("Failed to delete connection");
      }
    },
    [activeConnection, onConnectionChange]
  );

  const handleSelect = useCallback(
    (conn: Connection) => {
      onConnectionChange(conn);
      setShowForm(false);
    },
    [onConnectionChange]
  );

  // When a connection is active, show its info
  if (activeConnection) {
    const params = activeConnection.params as Record<string, string>;
    const isDirect = activeConnection.type === "direct";
    return (
      <div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">
                {activeConnection.label}
              </p>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {activeConnection.type.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => handleDelete(activeConnection.id)}
              className="text-xs text-gray-400 hover:text-red-500 transition shrink-0 ml-2"
            >
              Remove
            </button>
          </div>
          <div className="text-xs text-gray-500 space-y-0.5 mt-2">
            {isDirect ? (
              <>
                <p>
                  {params.db_type}: {params.host}:{params.port}/{params.database}
                </p>
                <p className="text-gray-400">User: {params.user}</p>
                {activeConnection.read_only_reminder && (
                  <p className="text-amber-600 font-medium mt-1">
                    Read-only mode active
                  </p>
                )}
              </>
            ) : (
              <p className="truncate">{params.url}</p>
            )}
          </div>

          {/* Schema Browser will be rendered by Sidebar below this */}
        </div>
      </div>
    );
  }

  // Show list of saved connections + add form toggle
  return (
    <div>
      {/* Saved connections list */}
      {connections.length > 0 && !showForm && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Saved Connections
          </h4>
          <div className="space-y-1">
            {connections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => handleSelect(conn)}
                className="w-full text-left p-2 rounded hover:bg-gray-100 transition text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="text-gray-800 truncate flex-1">
                    {conn.label}
                  </span>
                  <span className="text-gray-400 text-[10px] uppercase">
                    {conn.type}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add new connection button or form */}
      {showForm ? (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
          <h4 className="font-semibold text-gray-700">New Connection</h4>

          {/* Label */}
          <div>
            <label className="block text-gray-500 mb-0.5">Label (optional)</label>
            <input
              className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Database"
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-gray-500 mb-0.5">Type</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 py-1 rounded font-medium transition ${
                  connType === "direct"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setConnType("direct")}
              >
                Direct
              </button>
              <button
                className={`flex-1 py-1 rounded font-medium transition ${
                  connType === "mcp"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setConnType("mcp")}
              >
                MCP
              </button>
            </div>
          </div>

          {connType === "direct" ? (
            <>
              {/* DB Type */}
              <div>
                <label className="block text-gray-500 mb-0.5">Database</label>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 py-1 rounded font-medium transition ${
                      dbType === "mysql"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                    onClick={() => {
                      setDbType("mysql");
                      setPort("3306");
                    }}
                  >
                    MySQL
                  </button>
                  <button
                    className={`flex-1 py-1 rounded font-medium transition ${
                      dbType === "postgres"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                    onClick={() => {
                      setDbType("postgres");
                      setPort("5432");
                    }}
                  >
                    Postgres
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-500 mb-0.5">Host</label>
                  <input
                    className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-500 mb-0.5">Port</label>
                  <input
                    className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 mb-0.5">Database</label>
                <input
                  className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="doctor_finder"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-0.5">User</label>
                <input
                  className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-0.5">Password</label>
                <input
                  className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-gray-500 mb-0.5">MCP URL</label>
                <input
                  className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
                  value={mcpUrl}
                  onChange={(e) => setMcpUrl(e.target.value)}
                  placeholder="http://localhost:8080/mcp"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-0.5">
                  API Key (optional)
                </label>
                <input
                  className="w-full border border-gray-200 rounded px-2 py-1 text-gray-800"
                  type="password"
                  value={mcpApiKey}
                  onChange={(e) => setMcpApiKey(e.target.value)}
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-red-600 text-[10px]">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition text-xs"
            >
              {saving ? "Testing & Saving..." : "Test & Save"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
                setError(null);
              }}
              className="px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
        >
          + Add Connection
        </button>
      )}
    </div>
  );
}
