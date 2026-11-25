import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckSquare, KanbanSquare, FileText, X } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { cn } from '../lib/utils';

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results } = trpc.search.global.useQuery(
    { q: query },
    { enabled: query.trim().length >= 2 },
  );

  const hasResults = results && (results.tasks.length + results.board.length + results.documents.length) > 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (url: string) => {
    navigate(url);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          ref={inputRef}
          type="text"
          className="input h-9 w-full pl-9 pr-8 text-sm"
          placeholder="Search tasks, orders, documents…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full mt-1 w-full rounded-xl border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900 z-50">
          {!hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-ink-400">
              {query.trim().length < 2 ? 'Type to search…' : 'No results found'}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-2">
              {results.tasks.length > 0 && (
                <Section title="Tasks" icon={CheckSquare} items={results.tasks} onSelect={handleSelect} />
              )}
              {results.board.length > 0 && (
                <Section title="Operations" icon={KanbanSquare} items={results.board} onSelect={handleSelect} />
              )}
              {results.documents.length > 0 && (
                <Section title="Documents" icon={FileText} items={results.documents} onSelect={handleSelect} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, items, onSelect }: {
  title: string;
  icon: typeof Search;
  items: Array<{ id: string; url: string; label: string; sub: string }>;
  onSelect: (url: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 pb-1 pt-2">
        <Icon className="h-3.5 w-3.5 text-ink-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</span>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.url)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.label}</p>
            <p className="truncate text-xs capitalize text-ink-400">{item.sub}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
