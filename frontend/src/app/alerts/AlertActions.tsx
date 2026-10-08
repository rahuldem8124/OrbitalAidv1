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
      className="px-3 py-1 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 text-xs font-semibold disabled:opacity-50"
    >
      Acknowledge
    </button>
  );
}