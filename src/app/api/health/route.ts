import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Render health check. Reports the database too: a process that is up but
 * cannot reach Postgres is not actually healthy for this app.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "error" = "ok";
  let databaseError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = "error";
    databaseError = error instanceof Error ? error.message : "bilinmeyen hata";
  }

  const healthy = database === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "borcolcme-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        ...(databaseError ? { databaseError } : {}),
        jwtSecretConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
      },
      responseTimeMs: Date.now() - startedAt,
    },
    { status: healthy ? 200 : 503 }
  );
}
