import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required in production"),
  AUTH_TRUST_HOST: z.boolean().optional(),
  APP_URL: z.string().optional(),
  AI_PROVIDER: z.enum(["demo", "openai-compatible"]).default("demo"),
  AI_MODEL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().positive().default(30000),
  AI_MAX_TOKENS: z.coerce.number().positive().default(2000),
  CRON_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Environment validation failed:\n${issues.join("\n")}`);
  }

  if (parsed.data.NODE_ENV === "production" && !parsed.data.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required in production");
  }

  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

export function isDemoAI(): boolean {
  return getEnv().AI_PROVIDER === "demo";
}
