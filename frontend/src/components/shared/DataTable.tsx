"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";

interface DataTableProps<T> {
  columns: Array<{ key: string; label: string; sortable?: boolean; render?: (item: T) => ReactNode; width?: string }>;
  data: T[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (item: T) => string;
}

export default function DataTable<T>({
  columns, data, total, page, perPage, onPageChange, onSort, sortBy, sortOrder,
  onRowClick, loading = false, emptyMessage = "No data available.", rowKey,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / perPage);

  const handleSort = (key: string) => {
    if (!onSort) return;
    if (sortBy === key) {
      onSort(key, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, 'desc');
    }
  };

  return (
    <div className="w-full flex flex-col border border-[var(--space-border)] rounded-md overflow-hidden bg-[var(--space-panel)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--space-panel)] border-b border-[var(--space-border)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-[11px] font-mono font-semibold text-[var(--text-muted)] uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:text-[var(--text-secondary)] select-none' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="flex-shrink-0">
                        {sortBy === col.key ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: perPage }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-[var(--space-border)]">
                  {columns.map((col, j) => (
                    <td key={`skel-${i}-${j}`} className="px-4 py-3">
                      <div className="h-3.5 bg-[var(--space-border)]/50 rounded-sm animate-pulse w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[var(--text-muted)] text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={rowKey(item)}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`bg-[var(--space-card)] hover:bg-[var(--space-card-hover)] border-b border-[var(--space-border)] transition-colors duration-100 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={`${rowKey(item)}-${col.key}`} className="px-4 py-2.5 text-sm text-[var(--text-primary)]">
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--space-border)] bg-[var(--space-panel)]">
        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--space-card-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-[var(--text-secondary)] px-2">
            {page}/{Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--space-card-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
