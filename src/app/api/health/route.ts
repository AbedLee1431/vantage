import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
