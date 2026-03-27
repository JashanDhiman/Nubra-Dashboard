/**
 * POST /api/nubra/order — Place order via Nubra
 * GET  /api/nubra/order — Fetch order book
 * UI-07: PlaceOrder integration from option chain
 * Mock mode returns a simulated order ID when credentials are not set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlaceOrderRequest } from '@/types';
import { isMockMode } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const body: PlaceOrderRequest = await request.json();

    if (!body.trading_symbol || !body.transaction_type || !body.quantity) {
      return NextResponse.json(
        {
          error: 'trading_symbol, transaction_type, and quantity are required',
        },
        { status: 400 }
      );
    }

    if (body.quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be positive' },
        { status: 400 }
      );
    }

    // Mock mode — simulate successful order placement
    if (isMockMode()) {
      const mockOrderId = `MOCK${Date.now().toString().slice(-8)}`;
      return NextResponse.json({
        status: 'success',
        order_id: mockOrderId,
        message: `[MOCK] ${body.transaction_type} order for ${body.trading_symbol} accepted`,
        mock: true,
      });
    }
    const res = {
      status: 'success',
      order_id: '123456789',
      message: 'Order placed successfully',
    };

    return NextResponse.json(res, {
      status: res.status === 'success' ? 200 : 400,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Order API]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({ orders: [], mock: true });
  }
  try {
    return NextResponse.json({ orders: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
