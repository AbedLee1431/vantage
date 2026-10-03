import { execSync } from "node:child_process";
import { Client } from "pg";

const ADMIN_URL = "postgresql://vantage:vantage@localhost:5432/vantage";
const TEST_URL = "postgresql://vantage:vantage@localhost:5432/vantage_test";

/**
 * Vitest global setup (runs once, in its own process): ensure the `vantage_test`
 * database exists, then migrate it to the current schema. The dev database is
 * never touched.
 */
export default async function globalSetup() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query("CREATE DATABASE vantage_test");
  } catch (error) {
    if (!String((error as Error)?.message ?? error).includes("already exists")) {
      throw error;
    }
  } finally {
    await admin.end();
  }

  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: "inherit",
  });
}
