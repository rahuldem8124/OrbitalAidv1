"use client";

import { Search, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { SearchResults } from "@/lib/types";

interface SearchBarProps {
  onSearch: (query: string) => void;
  results?: SearchResults;
  loading?: boolean;
}

export default function SearchBar({ onSearch, results, loading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.length >= 2) {
        onSearch(query);
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, onSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="SEARCH TELEMETRY..."
          className="w-72 bg-[var(--space-canvas)] border border-[var(--space-border)] rounded-sm pl-9 pr-8 py-1.5 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--space-border-bright)] focus:ring-1 focus:ring-[var(--space-border-bright)] transition-all"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--accent-cyan)] animate-spin" />
        )}
      </div>

      {isOpen && results && !loading && (
        <div className="absolute top-full mt-1 w-full bg-[var(--space-panel)] border border-[var(--space-border-bright)] rounded-sm shadow-2xl overflow-hidden z-50">
          <div className="max-h-96 overflow-y-auto py-2">
            
            {results.objects?.length > 0 && (
              <div className="px-3 py-1.5">
                <div className="text-[9px] font-mono font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-widest border-b border-[var(--space-border)] pb-1">Objects</div>
                {results.objects.slice(0, 3).map(obj => (
                  <div key={obj.id} className="px-2 py-1.5 hover:bg-[var(--space-card-hover)] rounded-sm cursor-pointer transition-colors text-[11px] font-mono text-[var(--text-primary)]">
                    {obj.object_name}
                  </div>
                ))}
              </div>
            )}

            {results.conjunctions?.length > 0 && (
              <div className="px-3 py-1.5">
                <div className="text-[9px] font-mono font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-widest border-b border-[var(--space-border)] pb-1">Events</div>
                {results.conjunctions.slice(0, 3).map(evt => (
                  <div key={evt.id} className="px-2 py-1.5 hover:bg-[var(--space-card-hover)] rounded-sm cursor-pointer transition-colors text-[11px] font-mono text-[var(--text-primary)]">
                    TCA: {new Date(evt.tca).toISOString().substring(0, 19).replace('T', ' ')} UTC
                  </div>
                ))}
              </div>
            )}

            {results.objects?.length === 0 && results.conjunctions?.length === 0 && (
              <div className="px-4 py-6 text-center font-mono text-[11px] text-[var(--text-muted)]">
                NO RESULTS FOUND
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
