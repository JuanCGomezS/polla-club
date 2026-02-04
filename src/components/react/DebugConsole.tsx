import { useEffect, useState } from 'react';

interface LogEntry {
  type: 'log' | 'error' | 'warn';
  message: string;
  timestamp: number;
}

export default function DebugConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      setLogs(prev => [...prev, {
        type: 'log',
        message: args.map(String).join(' '),
        timestamp: Date.now()
      }]);
    };

    console.error = (...args) => {
      originalError(...args);
      setLogs(prev => [...prev, {
        type: 'error',
        message: args.map(String).join(' '),
        timestamp: Date.now()
      }]);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      setLogs(prev => [...prev, {
        type: 'warn',
        message: args.map(String).join(' '),
        timestamp: Date.now()
      }]);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-full shadow-lg z-50 text-xs"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
        <h2 className="font-bold">🐛 Debug Console</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="bg-gray-700 px-3 py-1 rounded text-xs"
          >
            Clear
          </button>
          <button
            onClick={() => setVisible(false)}
            className="bg-red-600 px-3 py-1 rounded text-xs"
          >
            Close
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={`mb-2 p-2 rounded ${
              log.type === 'error'
                ? 'bg-red-900 text-red-200'
                : log.type === 'warn'
                ? 'bg-yellow-900 text-yellow-200'
                : 'bg-gray-800 text-gray-200'
            }`}
          >
            <div className="text-gray-400 text-[10px]">
              {new Date(log.timestamp).toLocaleTimeString()}
            </div>
            <div className="whitespace-pre-wrap break-words">{log.message}</div>
          </div>
        ))}
        
        {logs.length === 0 && (
          <div className="text-gray-500 text-center mt-8">
            No hay logs aún. Interactúa con la app para ver logs.
          </div>
        )}
      </div>
    </div>
  );
}
