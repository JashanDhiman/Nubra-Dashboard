'use client';

import { useState, useCallback } from 'react';
import {
  PlaceOrderRequest,
  PlaceOrderResponse,
  OrderSide,
  OrderType,
  ProductType,
} from '@/types';

interface OrderState {
  isLoading: boolean;
  result: PlaceOrderResponse | null;
  error: string | null;
}

export function useOrderPlacement() {
  const [state, setState] = useState<OrderState>({
    isLoading: false,
    result: null,
    error: null,
  });

  const placeOrder = useCallback(
    async (order: PlaceOrderRequest): Promise<PlaceOrderResponse | null> => {
      setState({ isLoading: true, result: null, error: null });

      try {
        const res = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        });

        const result: PlaceOrderResponse = await res.json();

        setState({ isLoading: false, result, error: null });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Order failed';
        setState({ isLoading: false, result: null, error: msg });
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, error: null });
  }, []);

  return { ...state, placeOrder, reset };
}
