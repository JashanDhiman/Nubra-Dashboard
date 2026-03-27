/**
 * GET /api/nubra/options-chain?underlying=NIFTY&expiry=2025-03-27
 * DATA-01: REST API for option chain snapshots (Greeks, OI, LTP, depth)
 * PROC-02, PROC-03, PROC-04: Data processing on server before sending to client
 *
 * Auto-falls back to mock data when NUBRA_API_KEY is not configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateMaxPain, calculatePCR, calculateGEX } from '@/lib/analytics';
import {
  generateMockSnapshot,
  generateMockExpiries,
  isMockMode,
} from '@/lib/mock-data';
import { OptionChainSnapshot } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const underlying = searchParams.get('underlying') || 'NIFTY';
  const expiry = searchParams.get('expiry');
  const action = searchParams.get('action');

  // Get session token from Authorization header
  const authHeader = request.headers.get('authorization');
  const sessionToken = authHeader?.replace('Bearer ', '');

  if (!sessionToken && !isMockMode()) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // ── Mock mode: no credentials configured ──────────────────────────────────
  if (isMockMode()) {
    if (action === 'expiries') {
      return NextResponse.json(
        { expiries: generateMockExpiries(), mock: true },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const mockExpiry = expiry ?? generateMockExpiries()[0];
    const snapshot = generateMockSnapshot(underlying, mockExpiry, 20);

    // Still run analytics enrichment on mock data
    const enriched: OptionChainSnapshot = {
      ...snapshot,
      max_pain: calculateMaxPain(snapshot.rows),
      pcr: calculatePCR(snapshot.rows),
      rows: snapshot.rows.map(row => ({
        ...row,
        gex: calculateGEX(row, snapshot.spot),
        pcr: row.call.oi > 0 ? +(row.put.oi / row.call.oi).toFixed(2) : 0,
      })),
    };

    return NextResponse.json(
      { ...enriched, mock: true },
      { headers: { 'Cache-Control': 'no-store', 'X-Mock': 'true' } }
    );
  }

  // ── Live mode: real Nubra API ──────────────────────────────────────────────
  try {
    // Add device ID from environment variables
    const deviceId = process.env.NUBRA_DEVICE_ID || 'dashboard-device';

    if (action === 'expiries') {
      // For expiries, we need to call the option chain endpoint and extract all_expiries
      const response = await fetch(
        `${process.env.NUBRA_BASE_URL}/optionchains/${underlying}?exchange=NSE`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
            'x-device-id': deviceId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch expiries: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json({ expiries: data.chain.all_expiries || [] });
    }

    if (!expiry) {
      return NextResponse.json(
        { error: 'expiry is required' },
        { status: 400 }
      );
    }

    // Updated endpoint format to match documentation: /optionchains/{instrument}?exchange=NSE&expiry={expiry}
    const response = await fetch(
      `${process.env.NUBRA_BASE_URL}/optionchains/${underlying}?exchange=NSE&expiry=${expiry}`,
      {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch option chain: ${response.status}`);
    }

    const snapshot = await response.json(); // Raw API response

    // Transform the new API response format to match our expected structure
    const transformedSnapshot: OptionChainSnapshot = {
      underlying: snapshot.chain.asset,
      expiry: snapshot.chain.expiry,
      spot: snapshot.chain.cp,
      spot_change: 0, // Add default values
      spot_change_pct: 0,
      atm_strike: snapshot.chain.atm,
      total_call_oi:
        snapshot.chain.ce?.reduce(
          (sum: number, item: any) => sum + (item.oi || 0),
          0
        ) || 0,
      total_put_oi:
        snapshot.chain.pe?.reduce(
          (sum: number, item: any) => sum + (item.oi || 0),
          0
        ) || 0,
      pcr: 0,
      max_pain: 0,
      iv_rank: 0,
      iv_percentile: 0,
      timestamp: new Date().toISOString(), // Fixed: should be string
      rows: [],
    };

    // Combine CE and PE data into rows format
    const ceData = snapshot.chain.ce || [];
    const peData = snapshot.chain.pe || [];

    // Create rows by matching strike prices from CE and PE data
    const strikePrices = new Set([
      ...ceData.map((item: any) => item.sp),
      ...peData.map((item: any) => item.sp),
    ]);

    strikePrices.forEach((strike: number) => {
      const ceItem = ceData.find((item: any) => item.sp === strike);
      const peItem = peData.find((item: any) => item.sp === strike);

      const callOI = ceItem?.oi || 0;
      const putOI = peItem?.oi || 0;
      const isATM = strike === snapshot.chain.atm;

      transformedSnapshot.rows.push({
        strike: strike,
        call: {
          instrument_token: ceItem?.inst_id?.toString() || '0',
          trading_symbol: `${snapshot.chain.asset}${strike}CE`, // Construct trading symbol
          ltp: ceItem?.ltp || 0,
          bid: 0, // Default values since not in API response
          ask: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          change: ceItem?.ltpchg || 0,
          change_pct: 0,
          volume: ceItem?.volume || 0,
          oi: callOI,
          oi_change: 0,
          oi_change_pct: 0,
          tick_volume: 0,
          cumulative_volume: 0,
          cumulative_volume_premium: 0,
          greeks: {
            delta: ceItem?.delta || 0,
            gamma: ceItem?.gamma || 0,
            theta: ceItem?.theta || 0,
            vega: ceItem?.vega || 0,
            iv: ceItem?.iv || 0,
          },
          depth: { bids: [], asks: [] },
          exchange_timestamp: ceItem?.ts || Date.now() * 1_000_000,
        },
        put: {
          instrument_token: peItem?.inst_id?.toString() || '0',
          trading_symbol: `${snapshot.chain.asset}${strike}PE`, // Construct trading symbol
          ltp: peItem?.ltp || 0,
          bid: 0, // Default values since not in API response
          ask: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          change: peItem?.ltpchg || 0,
          change_pct: 0,
          volume: peItem?.volume || 0,
          oi: putOI,
          oi_change: 0,
          oi_change_pct: 0,
          tick_volume: 0,
          cumulative_volume: 0,
          cumulative_volume_premium: 0,
          greeks: {
            delta: peItem?.delta || 0,
            gamma: peItem?.gamma || 0,
            theta: peItem?.theta || 0,
            vega: peItem?.vega || 0,
            iv: peItem?.iv || 0,
          },
          depth: { bids: [], asks: [] },
          exchange_timestamp: peItem?.ts || Date.now() * 1_000_000,
        },
        isATM: isATM,
        pcr: callOI > 0 ? +(putOI / callOI).toFixed(2) : 0,
        netOI: putOI - callOI,
        gex: 0, // Will be calculated in enrichment step
        maxPainWeight: 0, // Will be calculated in enrichment step
      });
    });

    const enriched: OptionChainSnapshot = {
      ...transformedSnapshot,
      max_pain: calculateMaxPain(transformedSnapshot.rows),
      pcr: calculatePCR(transformedSnapshot.rows),
      rows: transformedSnapshot.rows.map(row => ({
        ...row,
        gex: calculateGEX(row, transformedSnapshot.spot),
        pcr: row.call.oi > 0 ? +(row.put.oi / row.call.oi).toFixed(2) : 0,
      })),
    };

    return NextResponse.json(enriched, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'X-Data-Timestamp': new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const status =
      err instanceof Error && err.message.includes('401') ? 401 : 500;
    console.error('[OptionChain API]', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
