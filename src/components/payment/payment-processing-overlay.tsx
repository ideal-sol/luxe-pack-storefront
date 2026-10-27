"use client";

import { useEffect, useRef } from "react";

export function PaymentProcessingOverlay({ message }: { message: string }) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    target.current?.focus();
    // Do not steal focus back when a provider-owned overlay opens.
  }, []);
  return <div aria-live="polite" className="payment-processing-overlay" ref={target} role="status" tabIndex={-1}>
    <span aria-hidden="true" className="payment-processing-overlay__spinner" /><p>{message}</p>
  </div>;
}
