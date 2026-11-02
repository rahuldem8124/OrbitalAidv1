import { LucideIcon } from "lucide-react";
import GlassPanel from "./GlassPanel";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export default function ComingSoon({ title, description, icon: Icon }: ComingSoonProps) {
  return (
    <GlassPanel className="flex flex-col items-center justify-center text-center py-24">
      <Icon className="w-12 h-12 text-white/20 mb-4" />
      <h2 className="text-white text-xl font-semibold mb-2">{title}</h2>
      <p className="text-white/50 max-w-md">{description}</p>
    </GlassPanel>
  );
}