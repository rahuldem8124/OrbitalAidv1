"use client";

import { AlertOctagon, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-[#ef4444]/20 rounded-md bg-[#ef4444]/5">
      <AlertOctagon className="w-10 h-10 text-[var(--tier-critical)] mb-3 opacity-80" />
      <h3 className="text-[var(--tier-critical)] font-medium mb-1">{title}</h3>
      <p className="text-sm text-[var(--tier-critical)]/70 mb-4 max-w-md">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--space-card-hover)] hover:bg-[var(--space-card-hover)]/80 border border-[var(--space-border)] text-[var(--text-primary)] text-sm rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}
