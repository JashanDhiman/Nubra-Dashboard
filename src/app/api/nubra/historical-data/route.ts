/**
 * POST /api/nubra/historical-data — Fetch historical data via Nubra
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get session token from Authorization header
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');

    console.log(
      '[Historical Data API] Session token:',
      sessionToken ? `${sessionToken.substring(0, 20)}...` : 'None'
    );
    console.log(
      '[Historical Data API] NUBRA_BASE_URL:',
      process.env.NUBRA_BASE_URL
    );

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.query || !Array.isArray(body.query) || body.query.length === 0) {
      return NextResponse.json(
        { error: 'Query array is required' },
        { status: 400 }
      );
    }

    // Validate each query object according to Nubra API specification
    for (const query of body.query) {
      if (
        !query.exchange ||
        !query.type ||
        !query.values ||
        !query.startDate ||
        !query.endDate ||
        !query.interval
      ) {
        return NextResponse.json(
          {
            error:
              'Each query must contain exchange, type, values, startDate, endDate, and interval',
          },
          { status: 400 }
        );
      }

      // Validate type is one of the allowed values
      const validTypes = ['STOCK', 'INDEX', 'OPT', 'FUT'];
      if (!validTypes.includes(query.type)) {
        return NextResponse.json(
          {
            error: `Type must be one of: ${validTypes.join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Validate interval format
      const validIntervals = [
        '1s',
        '1m',
        '2m',
        '3m',
        '5m',
        '15m',
        '30m',
        '1h',
        '1d',
        '1w',
        '1mt',
      ];
      if (!validIntervals.includes(query.interval)) {
        return NextResponse.json(
          {
            error: `Interval must be one of: ${validIntervals.join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Handle values - ensure it's an array for consistency
      if (typeof query.values === 'string') {
        query.values = [query.values];
      } else if (!Array.isArray(query.values)) {
        return NextResponse.json(
          {
            error: 'Values must be a string or array of strings',
          },
          { status: 400 }
        );
      }

      // Set default fields if not provided
      if (!query.fields || !Array.isArray(query.fields)) {
        query.fields = ['value'];
      }

      // Set default intraDay and realTime if not provided
      if (query.intraDay === undefined) {
        query.intraDay = false;
      }
      if (query.realTime === undefined) {
        query.realTime = false;
      }

      // Special handling for NIFTY instruments
      for (const value of query.values) {
        if (value.includes('NIFTY')) {
          // For NIFTY indices, ensure proper exchange
          if (query.type === 'INDEX' && query.exchange !== 'NSE') {
            return NextResponse.json(
              {
                error: 'NIFTY indices must use NSE exchange',
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Call Nubra historical data API
    const deviceId = process.env.NUBRA_DEVICE_ID || 'dashboard-device';
    console.log('[Historical Data API] Using device ID:', deviceId);
    console.log(
      '[Historical Data API] Request body:',
      JSON.stringify(body, null, 2)
    );

    const response = await fetch(
      `${process.env.NUBRA_BASE_URL}/charts/timeseries`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Nubra API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'X-Data-Timestamp': new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Historical Data API]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
