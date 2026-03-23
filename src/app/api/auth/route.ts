/**
 * POST /api/auth
 * AUTH-01, AUTH-02: Initiate MPIN-based auth and return session token
 * Auto-bypasses when NUBRA_API_KEY is not configured (mock mode).
 */

import { NextResponse } from "next/server";
import { nubraClient } from "@/lib/nubra-client";
import { isMockMode } from "@/lib/mock-data";

export async function POST() {
  // Mock mode — return a fake authenticated session instantly
  if (isMockMode()) {
    return NextResponse.json({
      authenticated: true,
      mock: true,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });
  }

  try {
    const result = await nubraClient.authenticate();

    if (result.status !== "success") {
      return NextResponse.json(
        { error: result.message || "Authentication failed" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      expiresAt: result.expires_at,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Auth API]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({ authenticated: true, mock: true });
  }
  const isAuthenticated = nubraClient.session.isValid();
  return NextResponse.json({ authenticated: isAuthenticated });
}