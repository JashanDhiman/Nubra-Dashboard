"use client";

import { useDashboardStore } from "@/lib/store";
import { format } from "date-fns";
import clsx from "clsx";

export function ConnectionBar() {
  const { connectionStatus, lastUpdateTime, snapshot } = useDashboardStore();
  const { ws, rest, auth } = connectionStatus;
  const isMock = (snapshot as any)?.mock === true;

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-surface-1 border-b border-border text-[11px] font-mono flex-wrap">
      {/* Mock mode banner */}
      {isMock && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-[10px]">
          <span>⚠</span>
          <span>MOCK MODE — set NUBRA_API_KEY in .env.local for live data</span>
        </div>
      )}

      {/* WS Status */}
      <StatusPill
        label="WebSocket"
        status={isMock ? "mock" : ws}
        map={{
          connected: "ok",
          connecting: "warn",
          disconnected: "off",
          error: "err",
          mock: "warn",
        }}
      />

      {/* REST Status */}
      <StatusPill
        label="REST"
        status={rest}
        map={{
          success: "ok",
          loading: "warn",
          idle: "off",
          error: "err",
        }}
      />

      {/* Auth Status */}
      <StatusPill
        label="Auth"
        status={isMock ? "mock" : auth}
        map={{
          authenticated: "ok",
          authenticating: "warn",
          unauthenticated: "off",
          expired: "err",
          mock: "warn",
        }}
      />

      <div className="ml-auto flex items-center gap-3 text-text-muted">
        {snapshot && (
          <span>
            {snapshot.underlying} · {snapshot.expiry}
          </span>
        )}
        {lastUpdateTime && (
          <span>Updated {format(lastUpdateTime, "HH:mm:ss")}</span>
        )}
      </div>
    </div>
  );
}

type Variant = "ok" | "warn" | "off" | "err";

function StatusPill({
  label,
  status,
  map,
}: {
  label: string;
  status: string;
  map: Record<string, Variant>;
}) {
  const variant = map[status] ?? "off";
  const colors: Record<Variant, string> = {
    ok: "text-accent-green",
    warn: "text-accent-amber",
    off: "text-text-muted",
    err: "text-accent-red",
  };
  const dotColors: Record<Variant, string> = {
    ok: "bg-accent-green animate-pulse-dot",
    warn: "bg-accent-amber animate-pulse-dot",
    off: "bg-text-muted",
    err: "bg-accent-red animate-pulse-dot",
  };

  return (
    <div className={clsx("flex items-center gap-1.5", colors[variant])}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", dotColors[variant])} />
      <span>{label}</span>
      <span className="opacity-50">·</span>
      <span className="capitalize">{status}</span>
    </div>
  );
}
