"use client";

import { useState, useEffect } from "react";
import { useDashboardStore } from "@/lib/store";
import { useOrderPlacement } from "@/hooks/useOrderPlacement";
import { OrderSide, OrderType, ProductType, PlaceOrderRequest } from "@/types";
import { formatPrice } from "@/lib/analytics";
import clsx from "clsx";

export function OrderPanel() {
  const { selectedStrike, selectedSide, filteredRows, snapshot, filter } = useDashboardStore();
  const { placeOrder, isLoading, result, error, reset } = useOrderPlacement();

  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [product, setProduct] = useState<ProductType>("MIS");

  // Auto-fill price when strike selected
  useEffect(() => {
    if (!selectedStrike || !selectedSide) return;
    const row = filteredRows.find((r) => r.strike === selectedStrike);
    if (!row) return;
    const leg = selectedSide === "call" ? row.call : row.put;
    setPrice(leg.ltp.toFixed(2));
    reset();
  }, [selectedStrike, selectedSide, filteredRows]); // eslint-disable-line

  const selectedRow = filteredRows.find((r) => r.strike === selectedStrike);
  const selectedLeg = selectedRow
    ? selectedSide === "call"
      ? selectedRow.call
      : selectedRow.put
    : null;

  const handleOrder = async (side: OrderSide) => {
    if (!selectedLeg || !snapshot) return;

    const order: PlaceOrderRequest = {
      trading_symbol: selectedLeg.trading_symbol,
      instrument_token: selectedLeg.instrument_token,
      exchange: "NFO",
      transaction_type: side,
      order_type: orderType,
      product,
      quantity: qty * 50, // 1 lot = 50 for NIFTY
      price: orderType === "LIMIT" ? parseFloat(price) : undefined,
      validity: "DAY",
      tag: "nubra-options-dashboard",
    };

    await placeOrder(order);
  };

  if (!selectedStrike || !selectedLeg) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
        <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-3">
          <span className="text-text-muted text-lg">↑</span>
        </div>
        <p className="text-text-muted font-mono text-xs leading-relaxed">
          Click any LTP in the option chain to populate order details
        </p>
      </div>
    );
  }

  const isCall = selectedSide === "call";

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Instrument info */}
      <div className="bg-surface-2 rounded border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <span
            className={clsx(
              "text-[10px] font-mono font-medium px-2 py-0.5 rounded",
              isCall ? "bg-accent-blue/20 text-accent-blue" : "bg-accent-red/20 text-accent-red"
            )}
          >
            {isCall ? "CALL" : "PUT"}
          </span>
          <span className="text-[10px] font-mono text-text-muted">{selectedLeg.trading_symbol}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[9px] font-mono text-text-muted mb-0.5">LTP</div>
            <div className="text-sm font-mono font-medium text-text-primary">
              {formatPrice(selectedLeg.ltp)}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-mono text-text-muted mb-0.5">BID</div>
            <div className="text-sm font-mono font-medium text-accent-green">
              {formatPrice(selectedLeg.bid)}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-mono text-text-muted mb-0.5">ASK</div>
            <div className="text-sm font-mono font-medium text-accent-red">
              {formatPrice(selectedLeg.ask)}
            </div>
          </div>
        </div>
        {selectedLeg.greeks && (
          <div className="grid grid-cols-4 gap-1 mt-2 pt-2 border-t border-border">
            {[
              { k: "IV", v: selectedLeg.greeks.iv.toFixed(1) + "%" },
              { k: "Δ", v: selectedLeg.greeks.delta.toFixed(2) },
              { k: "Θ", v: selectedLeg.greeks.theta.toFixed(2) },
              { k: "γ", v: selectedLeg.greeks.gamma.toFixed(4) },
            ].map(({ k, v }) => (
              <div key={k} className="text-center">
                <div className="text-[9px] font-mono text-text-muted">{k}</div>
                <div className="text-[10px] font-mono text-text-secondary">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Type */}
      <div>
        <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1.5">
          Order Type
        </label>
        <div className="grid grid-cols-4 gap-1">
          {(["MARKET", "LIMIT", "SL", "SL-M"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={clsx(
                "py-1 text-[10px] font-mono rounded border transition-colors",
                orderType === t
                  ? "border-accent-muted bg-accent-muted/20 text-text-primary"
                  : "border-border text-text-muted hover:text-text-secondary"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Product */}
      <div>
        <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1.5">
          Product
        </label>
        <div className="grid grid-cols-3 gap-1">
          {(["MIS", "NRML", "CNC"] as ProductType[]).map((p) => (
            <button
              key={p}
              onClick={() => setProduct(p)}
              className={clsx(
                "py-1 text-[10px] font-mono rounded border transition-colors",
                product === p
                  ? "border-accent-muted bg-accent-muted/20 text-text-primary"
                  : "border-border text-text-muted hover:text-text-secondary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Qty + Price */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1.5">
            Lots
          </label>
          <input
            type="number"
            min={1}
            max={500}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-[12px] font-mono text-text-primary outline-none focus:border-accent-muted"
          />
          <div className="text-[9px] font-mono text-text-muted mt-0.5">
            Qty: {qty * 50}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1.5">
            Price
          </label>
          <input
            type="number"
            min={0}
            step={0.05}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={orderType === "MARKET"}
            className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-[12px] font-mono text-text-primary outline-none focus:border-accent-muted disabled:opacity-40"
          />
        </div>
      </div>

      {/* Buy / Sell buttons */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          onClick={() => handleOrder("BUY")}
          disabled={isLoading}
          className="py-2.5 rounded font-mono font-medium text-[12px] bg-accent-green/90 hover:bg-accent-green text-surface-DEFAULT transition-colors disabled:opacity-50"
        >
          {isLoading ? "…" : "BUY"}
        </button>
        <button
          onClick={() => handleOrder("SELL")}
          disabled={isLoading}
          className="py-2.5 rounded font-mono font-medium text-[12px] bg-accent-red/90 hover:bg-accent-red text-white transition-colors disabled:opacity-50"
        >
          {isLoading ? "…" : "SELL"}
        </button>
      </div>

      {/* Result / Error */}
      {result && (
        <div
          className={clsx(
            "text-[11px] font-mono px-3 py-2 rounded border animate-slide-in",
            result.status === "success"
              ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
              : "bg-accent-red/10 border-accent-red/30 text-accent-red"
          )}
        >
          {result.status === "success"
            ? `✓ Order ${result.order_id} placed`
            : `✗ ${result.message}`}
        </div>
      )}
      {error && (
        <div className="text-[11px] font-mono px-3 py-2 rounded border bg-accent-red/10 border-accent-red/30 text-accent-red animate-slide-in">
          ✗ {error}
        </div>
      )}
    </div>
  );
}
