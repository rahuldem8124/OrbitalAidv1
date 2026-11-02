import ComingSoon from "@/components/ui/ComingSoon";
import { Database } from "lucide-react";

export default function DataSourcesPage() {
  return (
    <ComingSoon
      icon={Database}
      title="Data Sources & System Health"
      description="Feed status, catalog freshness, and ingestion source tracking — planned for a later phase."
    />
  );
}