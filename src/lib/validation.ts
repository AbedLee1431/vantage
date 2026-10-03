import { z } from "zod";

/**
 * Shared validation schemas (NFR-SEC-02). The server is the source of truth;
 * client forms reuse these for immediate feedback.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email is too long");

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(100, "Name is too long"),
});

export type FieldErrors = Record<string, string[]>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

// ── Phase 2: Discovery ──────────────────────────────────────────────────────
// Reads (list/search) parse leniently: invalid URL params fall back to defaults
// (allow-list still enforced, nothing unvalidated reaches the DB). Mutations
// (watchlists) validate strictly and return field errors.

export const itemTypeSchema = z.enum(["product", "store", "advertiser", "competitor"]);

const pageSchema = z.coerce.number().int().min(1).catch(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).catch(20);

export const productSortSchema = z
  .enum(["newest", "price-asc", "price-desc", "name"])
  .catch("newest");

export const productFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(100).optional().catch(undefined),
  storeId: z.string().trim().max(50).optional().catch(undefined),
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
  sort: productSortSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type ProductFilters = z.infer<typeof productFilterSchema>;

export const storeSortSchema = z.enum(["name", "newest", "products"]).catch("name");

export const storeFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(100).optional().catch(undefined),
  country: z.string().trim().max(100).optional().catch(undefined),
  platform: z.string().trim().max(100).optional().catch(undefined),
  sort: storeSortSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type StoreFilters = z.infer<typeof storeFilterSchema>;

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
});

/** Lenient parse for read filters: invalid values fall back to schema defaults. */
export function parseFilters<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input ?? {});
  if (parsed.success) return parsed.data;
  // Re-parse empty to guarantee valid defaults even for hostile input.
  return schema.parse({});
}

export const createWatchlistSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
});

export const watchlistItemSchema = z.object({
  watchlistId: z.string().min(1, "Watchlist is required").max(50),
  itemType: itemTypeSchema,
  refId: z.string().min(1, "Item is required").max(50),
});

export const toggleSaveSchema = z.object({
  itemType: itemTypeSchema,
  refId: z.string().min(1, "Item is required").max(50),
});

export const removeWatchlistItemSchema = z.object({
  itemId: z.string().min(1, "Item is required").max(50),
});

// ── Phase 4: AI Intelligence ────────────────────────────────────────────────
// Analyst + analysis requests validate strictly (mutations / billable actions).

export const analystMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(2000, "Message is too long"),
  conversationId: z.string().min(1).max(50).optional(),
});

export const analyzeAdRequestSchema = z.object({
  force: z.boolean().optional(),
});

export const analyzeCompetitorRequestSchema = z.object({
  storeId: z.string().min(1).max(50).optional(),
  domain: z.string().trim().max(255).optional(),
  force: z.boolean().optional(),
});

export const cuidParamSchema = z.object({
  id: z.string().min(1).max(50),
});

// ── Phase 3: Ad Intelligence ────────────────────────────────────────────────

export const adSortSchema = z.enum(["newest", "oldest", "longest"]).catch("newest");

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .catch(undefined);

export const adFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  platform: z.string().trim().max(50).optional().catch(undefined),
  advertiserId: z.string().trim().max(50).optional().catch(undefined),
  storeId: z.string().trim().max(50).optional().catch(undefined),
  category: z.string().trim().max(100).optional().catch(undefined),
  format: z.string().trim().max(50).optional().catch(undefined),
  minDuration: z.coerce.number().int().min(0).optional().catch(undefined),
  maxDuration: z.coerce.number().int().min(0).optional().catch(undefined),
  from: dateStringSchema,
  to: dateStringSchema,
  sort: adSortSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type AdFilters = z.infer<typeof adFilterSchema>;

// ── Phase 5: Customer Intelligence ──────────────────────────────────────────
// Reads parse leniently (bad URL params fall back to defaults); mutations
// (archive/restore) validate strictly.

export const reviewSortSchema = z.enum(["newest", "oldest", "highest", "lowest"]).catch("newest");

export const reviewFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  productId: z.string().trim().max(50).optional().catch(undefined),
  storeId: z.string().trim().max(50).optional().catch(undefined),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  from: dateStringSchema,
  to: dateStringSchema,
  sort: reviewSortSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type ReviewFilters = z.infer<typeof reviewFilterSchema>;

export const reviewSummaryRequestSchema = z.object({
  productId: z.string().min(1).max(50).optional(),
  storeId: z.string().min(1).max(50).optional(),
  force: z.boolean().optional(),
});

export const opportunityIdSchema = z.object({
  id: z.string().min(1).max(50),
});

// ── Phase 6: Monitoring ─────────────────────────────────────────────────────
// Timeline reads parse leniently; acknowledgment validates strictly.

export const changeTypeSchema = z
  .enum([
    "new_product",
    "removed_product",
    "new_ad",
    "ad_activity_change",
    "price_change",
    "landing_page_change",
    "review_change",
  ])
  .optional()
  .catch(undefined);

export const timelineFilterSchema = z.object({
  type: changeTypeSchema.optional(),
  ref: z.string().trim().max(50).optional().catch(undefined),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type TimelineFilters = z.infer<typeof timelineFilterSchema>;

export const acknowledgeAlertSchema = z.object({
  id: z.string().min(1, "Alert is required").max(50),
});

// ── Phase 8: Billing ────────────────────────────────────────────────────────
// Checkout validates strictly (billable); plan codes come from central config.

export const checkoutRequestSchema = z.object({
  planCode: z.string().trim().min(1, "Plan is required").max(20),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

// ── Phase 7: Reports ────────────────────────────────────────────────────────
// Creation validates strictly (billable job); history reads parse leniently.

export const reportTypeSchema = z.enum([
  "competitor",
  "product",
  "advertising",
  "customer",
  "trends",
  "monitoring",
  "combined",
]);

export const createReportSchema = z
  .object({
    type: reportTypeSchema,
    storeId: z.string().min(1).max(50).optional(),
    productId: z.string().min(1).max(50).optional(),
    advertiserId: z.string().min(1).max(50).optional(),
    platform: z.string().trim().max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "competitor" && !data.storeId) {
      ctx.addIssue({
        code: "custom",
        message: "Competitor reports require a store.",
        path: ["storeId"],
      });
    }
    if (data.type === "product" && !data.productId) {
      ctx.addIssue({
        code: "custom",
        message: "Product reports require a product.",
        path: ["productId"],
      });
    }
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const reportHistoryFilterSchema = z.object({
  type: reportTypeSchema.optional().catch(undefined),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
