"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeAlert } from "@/lib/api";

export default function AlertActions({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      await acknowledgeAlert(alertId, "operator-1");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Action failed — check the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      disabled={loading}
      onClick={handle}
      className="px-3 py-1 rounded-sm bg-amber-400 hover:bg-amber-300 text-black border border-amber-400 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
    >
      Acknowledge
    </button>
  );
}