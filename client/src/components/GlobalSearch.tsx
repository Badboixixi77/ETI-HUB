import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CheckSquare, KanbanSquare, FileText, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { cn } from "../lib/utils";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce input → query (300ms)
  const handleInput = useCallback((val: string) => {
    setInputValue(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 300);
  }, []);

  const { data: results } = trpc.search.global.useQuery(
    { q: debouncedQuery },
    { enabled: debouncedQuery.trim().length >= 2 },
  );

  const hasResults =
    results &&
    results.tasks.length + results.board.length + results.documents.length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setInputValue("");
        setDebouncedQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (url: string) => {
    navigate(url);
    setInputValue("");
    setDebouncedQuery("");
    setOpen(false);
  };

  const clear = () => {
    setInputValue("");
    setDebouncedQuery("");
    setOpen(false);
  };

  const showDropdown = open && inputValue.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          type="text"
          className="input h-9 w-full pl-9 pr-8 text-sm"
          placeholder="Search tasks, orders, documents…"
          value={inputValue}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => inputValue.trim().length >= 2 && setOpen(true)}
          aria-label="Global search"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
        />
        {inputValue && (
          <button
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900">
          {!hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-ink-400">
              {debouncedQuery.trim().length < 2
                ? "Type to search…"
                : "No results found"}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-2">
              {results.tasks.length > 0 && (
                <ResultSection
                  title="Tasks"
                  icon={CheckSquare}
                  items={results.tasks}
                  onSelect={handleSelect}
                />
              )}
              {results.board.length > 0 && (
                <ResultSection
                  title="Operations"
                  icon={KanbanSquare}
                  items={results.board}
                  onSelect={handleSelect}
                />
              )}
              {results.documents.length > 0 && (
                <ResultSection
                  title="Documents"
                  icon={FileText}
                  items={results.documents}
                  onSelect={handleSelect}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({
  title,
  icon: Icon,
  items,
  onSelect,
}: {
  title: string;
  icon: typeof Search;
  items: Array<{ id: string; url: string; label: string; sub: string }>;
  onSelect: (url: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 pb-1 pt-2">
        <Icon className="h-3.5 w-3.5 text-ink-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {title}
        </span>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.url)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink-50 active:bg-ink-100 dark:hover:bg-ink-800"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.label}</p>
            <p className="truncate text-xs capitalize text-ink-400">
              {item.sub}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
