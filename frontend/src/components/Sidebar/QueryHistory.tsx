interface HistoryItem {
  query: string;
  type: string;
  timestamp: number;
}

interface QueryHistoryProps {
  history: HistoryItem[];
  onSelect: (query: string) => void;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function QueryHistory({ history, onSelect }: QueryHistoryProps) {
  if (!history.length) {
    return (
      <p className="text-xs text-gray-400">
        No queries yet. Type a question and press Run.
      </p>
    );
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {history.map((item, i) => (
        <button
          key={i}
          onClick={() => onSelect(item.query)}
          className="w-full text-left p-2 rounded hover:bg-gray-100 transition text-xs"
        >
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                item.type === "error"
                  ? "bg-red-400"
                  : item.type === "chart"
                  ? "bg-purple-400"
                  : "bg-blue-400"
              }`}
            />
            <span className="text-gray-800 truncate flex-1">{item.query}</span>
          </div>
          <span className="text-gray-400 ml-3.5">{formatTime(item.timestamp)}</span>
        </button>
      ))}
    </div>
  );
}
