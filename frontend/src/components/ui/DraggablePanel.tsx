"use client";

import { ReactNode, useState, useRef, useCallback, useEffect } from "react";
import { X, GripHorizontal } from "lucide-react";

interface DraggablePanelProps {
  children: ReactNode;
  title?: string;
  onClose: () => void;
  className?: string;
  initialX?: number;
  initialY?: number;
}

export default function DraggablePanel({
  children,
  title,
  onClose,
  className = "",
  initialX = 400,
  initialY = 80,
}: DraggablePanelProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onMouseUp = () => setDragging(false);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`fixed z-50 backdrop-blur-md bg-white/5 border border-white/10 rounded-md shadow-2xl shadow-black/40 ${className}`}
        style={{
          left: pos.x,
          top: pos.y,
          width: 480,
          maxHeight: "85vh",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-move select-none"
          onMouseDown={onMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-white/30" />
            {title && (
              <span className="text-white/80 text-sm font-semibold">{title}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 52px)" }}>
          {children}
        </div>
      </div>
    </>
  );
}
