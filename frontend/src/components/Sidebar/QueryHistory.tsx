interface HistoryItem {
  query: string;
  type: string;
  timestamp: number;
}

interface QueryHistoryProps {
  history: HistoryItem[];
  onSelect: (query: string) => void;
}



export default function QueryHistory({ history, onSelect }: QueryHistoryProps) {
  if (!history.length) {
    return (
      <p className="text-xs text-on-surface-variant/60 italic px-1">
        No queries in workspace history
      </p>
    );
  }

  return (
    <ul className="space-y-2 mt-2 max-h-48 overflow-y-auto no-scrollbar">
      {history.map((item, i) => (
        <li
          key={i}
          onClick={() => onSelect(item.query)}
          className="flex gap-2 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer select-none transition-colors"
        >
          <span className={
            item.type === "error"
              ? "text-red-500 font-bold"
              : item.type === "chart"
              ? "text-purple-500 font-bold"
              : "text-blue-500 font-bold"
          }>•</span>
          <span className="truncate flex-1" title={item.query}>{item.query}</span>
        </li>
      ))}
    </ul>
  );
}
