"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  externalId: string;
  name: string;
  country?: string;
  league?: string;
  logoUrl?: string;
  sport?: string;
  shortName?: string;
  isNational?: boolean;
  provider: string;
}

interface ApiSearchInputProps {
  /** Label shown above the input */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Called with the selected result — prefill the form */
  onSelect: (result: SearchResult) => void;
  /** Async search function — must be a server action or async call */
  onSearch: (query: string) => Promise<{ success: boolean; results: SearchResult[]; error?: string }>;
  /** Debounce delay in ms */
  debounceMs?: number;
}

export function ApiSearchInput({
  label,
  placeholder = "Search by name...",
  onSelect,
  onSearch,
  debounceMs = 300,
}: ApiSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Click outside to close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  const doSearch = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      if (!q.trim() || q.trim().length < 1) {
        setResults([]);
        setOpen(false);
        return;
      }

      timerRef.current = setTimeout(async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await onSearch(q.trim());
          if (res.success) {
            setResults(res.results);
            setOpen(res.results.length > 0);
            setActiveIndex(-1);
          } else {
            setError(res.error ?? "Search failed.");
            setResults([]);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed.");
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  function handleSelect(result: SearchResult) {
    setSelected(result);
    setQuery(result.name);
    setOpen(false);
    onSelect(result);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {label && <span className="text-label text-text-secondary">{label}</span>}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            doSearch(e.target.value);
          }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border-default bg-bg-tertiary py-2.5 pl-10 pr-4 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent-blue" />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="flex items-center gap-1 text-caption text-accent-red">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {/* Selected badge */}
      {selected && !open && (
        <div className="flex items-center gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-1.5">
          <CheckCircle2 className="h-4 w-4 text-accent-green" />
          <span className="text-body-sm text-text-primary">{selected.name}</span>
          {selected.country && (
            <span className="text-caption text-text-tertiary">{selected.country}</span>
          )}
          <span className="ml-auto rounded bg-bg-tertiary px-1.5 py-0.5 text-caption text-text-disabled font-mono">
            {selected.provider}
          </span>
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border-default bg-bg-secondary shadow-lg">
          {results.map((r, idx) => (
            <button
              key={r.id || idx}
              type="button"
              onClick={() => handleSelect(r)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                idx === activeIndex
                  ? "bg-accent-gold/10"
                  : "hover:bg-bg-tertiary",
                idx !== results.length - 1 && "border-b border-border-muted"
              )}
            >
              {r.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded object-contain bg-white/10" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg-tertiary">
                  <Search className="h-4 w-4 text-text-disabled" />
                </div>
              )}

              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-body-sm font-medium text-text-primary">
                  {r.name}
                  {r.shortName && (
                    <span className="ml-1.5 text-caption text-text-disabled">{r.shortName}</span>
                  )}
                </p>
                <p className="text-caption text-text-tertiary">
                  {[r.country, r.league, r.sport].filter(Boolean).join(" · ")}
                </p>
              </div>

              <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-0.5 text-caption text-text-disabled font-mono">
                {r.provider}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
