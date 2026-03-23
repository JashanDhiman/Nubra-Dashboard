"use client";

import { useEffect } from "react";
import { useLiveOptionChain } from "@/hooks/useLiveOptionChain";
import { useDashboardStore } from "@/lib/store";
import { TopBar } from "@/components/ui/TopBar";
import { ConnectionBar } from "@/components/ui/ConnectionBar";
import { StatsRow } from "@/components/ui/StatsRow";
import { ChainControls } from "@/components/ui/ChainControls";
import { OptionChainTable } from "@/components/OptionChainTable";
import { SidePanel } from "@/components/SidePanel";

export default function DashboardPage() {
  const { filter, setFilter } = useDashboardStore();

  // Kick off live data pipeline
  useLiveOptionChain();

  // Set default expiry once expiries load
  const { expiries } = useDashboardStore();
  useEffect(() => {
    if (expiries.length > 0 && !filter.expiry) {
      setFilter({ expiry: expiries[0] });
    }
  }, [expiries, filter.expiry, setFilter]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      {/* Top navigation bar */}
      <TopBar />

      {/* Connection status bar */}
      <ConnectionBar />

      {/* Key metrics row */}
      <StatsRow />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Option chain table + controls */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <ChainControls />
          <div className="flex-1 overflow-auto">
            <OptionChainTable />
          </div>
        </div>

        {/* Side panel — charts + order entry */}
        <SidePanel />
      </div>
    </div>
  );
}
