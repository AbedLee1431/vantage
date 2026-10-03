"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Browser print (user saves as PDF from the print dialog — no server PDF stack). */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" aria-hidden /> Print / Save as PDF
    </Button>
  );
}
