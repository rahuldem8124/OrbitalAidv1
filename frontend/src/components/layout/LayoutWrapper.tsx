"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { usePathname } from "next/navigation";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("orbitaid_sidebar_collapsed");
    if (saved) {
      setSidebarCollapsed(JSON.parse(saved));
    }

    const handleToggle = (e: CustomEvent<boolean>) => {
      setSidebarCollapsed(e.detail);
    };

    window.addEventListener('sidebarToggle', handleToggle as EventListener);
    return () => window.removeEventListener('sidebarToggle', handleToggle as EventListener);
  }, []);

  const isMissionControl = pathname === "/";

  return (
    <>
      <Sidebar />
      <div 
        className={`flex flex-col h-screen transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-16' : 'ml-64'} overflow-hidden`}
      >
        <TopBar />
        <main className={`flex-1 ${isMissionControl ? 'overflow-hidden p-0' : 'overflow-x-hidden overflow-y-auto p-6'}`}>
          <div className={isMissionControl ? "h-full w-full" : "max-w-7xl mx-auto space-y-6"}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
