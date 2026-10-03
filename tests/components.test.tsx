/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ProductCard } from "@/components/discovery/product-card";
import { StoreCard } from "@/components/discovery/store-card";
import { AdCard } from "@/components/discovery/ad-card";
import { Pagination } from "@/components/discovery/pagination";
import { TrendBars } from "@/components/discovery/trend-chart";

// next/link needs router context; stub it to a plain anchor for unit tests.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// jsdom renders accumulate without globals; clean up between tests explicitly.
afterEach(() => {
  cleanup();
});

describe("design-system components", () => {
  it("ProvenanceBadge labels provenance explicitly", () => {
    const { unmount } = render(<ProvenanceBadge provenance="demo" />);
    expect(screen.getByText("Demo data")).toBeTruthy();
    unmount();
    render(<ProvenanceBadge provenance="ai" />);
    expect(screen.getByText("AI-generated")).toBeTruthy();
  });

  it("EmptyState renders an actionable empty view", () => {
    render(<EmptyState title="No products yet" description="Discover some." />);
    expect(screen.getByText("No products yet")).toBeTruthy();
    expect(screen.getByText("Discover some.")).toBeTruthy();
  });

  it("Button renders and respects disabled", () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("Field pairs labels with errors accessibly", () => {
    render(
      <Field label="Email" htmlFor="email" error="Required">
        <Input id="email" name="email" invalid />
      </Field>,
    );
    expect(screen.getByText("Email")).toBeTruthy();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Required");
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
});

describe("discovery components", () => {
  it("ProductCard shows name, store, price, and provenance", () => {
    render(
      <ProductCard
        product={{
          id: "p1",
          name: "Trailhead Jacket",
          category: "Jackets",
          price: 189,
          currency: "USD",
          storeName: "Nordwind",
          tags: ["winter"],
          isNew: true,
          provenance: "demo",
        }}
      />,
    );
    expect(screen.getByText("Trailhead Jacket")).toBeTruthy();
    expect(screen.getByText("$189.00")).toBeTruthy();
    expect(screen.getByText("Demo data")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
  });

  it("StoreCard shows identity, meta, and product count", () => {
    render(
      <StoreCard
        store={{
          id: "s1",
          name: "Nordwind",
          domain: "nordwind.example",
          category: "Outdoor",
          country: "US",
          platform: "Shopify",
          productCount: 3,
          provenance: "demo",
        }}
      />,
    );
    expect(screen.getByText("Nordwind")).toBeTruthy();
    expect(screen.getByText("3 products")).toBeTruthy();
  });

  it("Pagination announces counts and renders page links", () => {
    render(
      <Pagination
        path="/products"
        searchParams={{ q: "jacket" }}
        page={2}
        totalPages={4}
        total={38}
      />,
    );
    expect(screen.getByText("38 results · Page 2 of 4")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Page 3" }).getAttribute("href")).toContain("page=3");
    expect(screen.getByRole("link", { name: "Page 3" }).getAttribute("href")).toContain("q=jacket");
  });

  it("TrendBars renders an accessible chart with a text summary", () => {
    render(
      <TrendBars
        id="t"
        title="New products per week"
        labels={["Sep 1", "Sep 8"]}
        values={[1, 4]}
      />,
    );
    expect(screen.getByRole("img", { name: /New products per week/ })).toBeTruthy();
    // summary appears both as SVG <desc> (screen readers) and visible caption
    expect(screen.getAllByText(/peak 4 in week of Sep 8/)).toHaveLength(2);
  });

  it("AdCard shows creative, badges, and run length — never performance claims", () => {
    render(
      <AdCard
        ad={{
          id: "a1",
          title: "Winter is coming",
          platform: "Meta",
          format: "video",
          status: "active",
          durationDays: 21,
          firstSeen: new Date("2026-09-09T00:00:00Z"),
          advertiserName: "Nordwind",
          storeName: "Nordwind Outdoors",
          provenance: "demo",
        }}
      />,
    );
    expect(screen.getByText("Winter is coming")).toBeTruthy();
    expect(screen.getByText("Meta")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText(/21 days/)).toBeTruthy();
    expect(screen.getByText("Demo data")).toBeTruthy();
    // no spend/impression/conversion language anywhere on the card
    expect(screen.queryByText(/spend|impression|conversion|click-through/i)).toBeNull();
  });
});
