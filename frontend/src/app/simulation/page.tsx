import { Suspense } from "react";
import SimulationClient from "./SimulationClient";
import GlassPanel from "@/components/ui/GlassPanel";
import { Loader2 } from "lucide-react";

export default function SimulationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <h1 className="text-white text-2xl font-semibold">Simulation & What-If Analysis</h1>
          <GlassPanel className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </GlassPanel>
        </div>
      }
    >
      <SimulationClient />
    </Suspense>
  );
}
