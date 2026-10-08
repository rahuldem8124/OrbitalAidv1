"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveManeuver, rejectManeuver } from "@/lib/api";

export default function ManeuverActions({ maneuverId }: { maneuverId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handle = async (action: "approve" | "reject") => {
    setLoading(true);
    try {
      if (action === "approve") {
        await approveManeuver(maneuverId, "operator-1");
      } else {
        await rejectManeuver(maneuverId, "operator-1");
      }
      router.refresh(); // re-fetches the server component's data, no full page reload
    } catch (err) {
      console.error(err);
      alert("Action failed — check the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        disabled={loading}
        onClick={() => handle("approve")}
        className="px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-semibold disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={loading}
        onClick={() => handle("reject")}
        className="px-3 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-xs font-semibold disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}