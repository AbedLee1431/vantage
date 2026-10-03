"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Client-side billing actions (checkout + portal round-trips). */
export function CheckoutButton({ planCode }: { planCode: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: { message?: string } };
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error?.message ?? "Checkout could not start. Please try again.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Checkout could not start. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={pending}>
        {pending ? "Starting checkout…" : "Upgrade to Pro"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PortalButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { portalUrl?: string; error?: { message?: string } };
      if (!res.ok || !data.portalUrl) {
        setError(data.error?.message ?? "Billing portal is unavailable right now.");
        return;
      }
      window.location.href = data.portalUrl;
    } catch {
      setError("Billing portal is unavailable right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={open} disabled={pending}>
        {pending ? "Opening portal…" : "Manage billing"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
