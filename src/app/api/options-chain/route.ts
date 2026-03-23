/**
 * GET /api/options-chain?underlying=NIFTY&expiry=2025-03-27
 * DATA-01: REST API for option chain snapshots (Greeks, OI, LTP, depth)
 * PROC-02, PROC-03, PROC-04: Data processing on server before sending to client
 *
 * Auto-falls back to mock data when NUBRA_API_KEY is not configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { nubraClient } from "@/lib/nubra-client";
import { calculateMaxPain, calculatePCR, calculateGEX } from "@/lib/analytics";
import {
  generateMockSnapshot,
  generateMockExpiries,
  isMockMode,
} from "@/lib/mock-data";
import { OptionChainSnapshot } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const underlying = searchParams.get("underlying") || "NIFTY";
  const expiry = searchParams.get("expiry");
  const action = searchParams.get("action");

  // ── Mock mode: no credentials configured ──────────────────────────────────
  if (isMockMode()) {
    if (action === "expiries") {
      return NextResponse.json(
        { expiries: generateMockExpiries(), mock: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const mockExpiry = expiry ?? generateMockExpiries()[0];
    const snapshot = generateMockSnapshot(underlying, mockExpiry, 20);

    // Still run analytics enrichment on mock data
    const enriched: OptionChainSnapshot = {
      ...snapshot,
      max_pain: calculateMaxPain(snapshot.rows),
      pcr: calculatePCR(snapshot.rows),
      rows: snapshot.rows.map((row) => ({
        ...row,
        gex: calculateGEX(row, snapshot.spot),
        pcr: row.call.oi > 0 ? +(row.put.oi / row.call.oi).toFixed(2) : 0,
      })),
    };

    return NextResponse.json(
      { ...enriched, mock: true },
      { headers: { "Cache-Control": "no-store", "X-Mock": "true" } }
    );
  }

  // ── Live mode: real Nubra API ──────────────────────────────────────────────
  try {
    if (action === "expiries") {
      const expiries = await nubraClient.getExpiries(underlying);
      return NextResponse.json({ expiries });
    }

    if (!expiry) {
      return NextResponse.json({ error: "expiry is required" }, { status: 400 });
    }

    const snapshot: OptionChainSnapshot = await nubraClient.getOptionChain(
      underlying,
      expiry
    );

    const enriched: OptionChainSnapshot = {
      ...snapshot,
      max_pain: calculateMaxPain(snapshot.rows),
      pcr: calculatePCR(snapshot.rows),
      rows: snapshot.rows.map((row) => ({
        ...row,
        gex: calculateGEX(row, snapshot.spot),
        pcr: row.call.oi > 0 ? +(row.put.oi / row.call.oi).toFixed(2) : 0,
      })),
    };

    return NextResponse.json(enriched, {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        "X-Data-Timestamp": new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status =
      err instanceof Error && err.message.includes("401") ? 401 : 500;
    console.error("[OptionChain API]", msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
