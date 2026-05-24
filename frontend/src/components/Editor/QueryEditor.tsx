import { useRef } from "react";
import Editor from "@monaco-editor/react";

interface QueryEditorProps {
  value: string;
  onChange: (val: string) => void;
  onRun: () => void;
  loading: boolean;
  mode: "python" | "sql";
}

export default function QueryEditor({
  value,
  onChange,
  onRun,
  loading,
  mode,
}: QueryEditorProps) {
  const editorRef = useRef<unknown>(null);

  const handleMount = (editor: unknown) => {
    editorRef.current = editor;
    const ed = editor as { addAction?: (action: Record<string, unknown>) => void };
    if (ed.addAction) {
      ed.addAction({
        id: "run-query",
        label: "Run Query",
        keybindings: 2048 | 13, // Ctrl+Enter
        run: () => onRun(),
      });
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 uppercase">
            {mode === "python" ? "Natural Language Query" : "Natural Language → SQL"}
          </span>
          <span className="text-xs text-gray-300 hidden sm:inline">Ctrl+Enter to run</span>
        </div>
        <button
          onClick={onRun}
          disabled={loading || !value.trim()}
          className="text-sm px-4 py-1.5 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run
            </>
          )}
        </button>
      </div>

      {/* Monaco Editor */}
      <div className="h-32">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          language={mode === "python" ? "plaintext" : "sql"}
          value={value}
          onChange={(val) => onChange(val ?? "")}
          onMount={handleMount}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            lineNumbers: "on",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            padding: { top: 8 },
            fontSize: 13,
            fontFamily: "ui-monospace, Consolas, monospace",
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );
}
