interface ErrorResultProps {
  ename?: string;
  message?: string;
}

export default function ErrorResult({ ename, message }: ErrorResultProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium text-red-700">
          {ename || "Error"}
        </span>
      </div>
      {message && (
        <p className="text-sm text-red-600 ml-6">{message}</p>
      )}
    </div>
  );
}
