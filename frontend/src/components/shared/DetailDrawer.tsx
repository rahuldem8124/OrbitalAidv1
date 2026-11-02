"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export default function DetailDrawer({ open, onClose, title, children, width = "w-full max-w-md" }: DetailDrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />
      <div className={`fixed top-0 right-0 h-full bg-[var(--space-panel)] border-l border-[var(--space-border)] z-50 flex flex-col ${width}`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--space-border)]">
          <h2 className="text-sm font-mono font-semibold text-[var(--text-primary)] uppercase tracking-wider">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-[var(--space-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </>
  );
}
