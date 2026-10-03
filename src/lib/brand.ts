/**
 * Centralized brand configuration (ADR-010). A rename or rebrand touches this
 * file and the design tokens in `src/app/globals.css` — nothing else.
 */

export const brand = {
  name: "Vantage",
  tagline: "Understand what is happening in e-commerce before making your next move.",
  description:
    "AI-powered e-commerce competitive intelligence. Discover products, research competitors, analyze ads, and find market gaps — grounded in evidence.",
  legalName: "Vantage",
  supportEmail: "support@vantage.example",
} as const;
