import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { UnauthorizedError, getCurrentSession, type SessionPayload } from "@/lib/auth";
import { ConflictError, NotFoundError } from "@/lib/db/debts";
import { GoldPriceUnavailableError } from "@/lib/gold/types";

/**
 * One place that turns thrown errors into HTTP responses, so route handlers
 * never swallow a failure or leak a stack trace to the client.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof GoldPriceUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "Gönderilen veri geçersiz",
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 }
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Bu kayıt zaten mevcut" }, { status: 409 });
    }
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "İlişkili kayıt bulunamadı (kategori, kurum veya borç geçersiz)" },
        { status: 422 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error("Veritabanı bağlantı hatası:", error);
    return NextResponse.json(
      { error: "Veritabanına ulaşılamıyor. Lütfen daha sonra tekrar deneyin." },
      { status: 503 }
    );
  }

  console.error("Beklenmeyen API hatası:", error);
  const message =
    process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : "Sunucu hatası oluştu";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Wraps a handler with session lookup and unified error handling. */
export function withSession<T>(
  handler: (session: SessionPayload, context: T) => Promise<NextResponse>
) {
  return async (context: T): Promise<NextResponse> => {
    try {
      const session = await getCurrentSession();
      if (!session) throw new UnauthorizedError();
      return await handler(session, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Parses a JSON body against a schema, rejecting malformed JSON cleanly.
 * Generic over the schema so `.default()` values land in the OUTPUT type.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ZodError([
      { code: "custom", path: [], message: "İstek gövdesi geçerli bir JSON değil" },
    ]);
  }
  return schema.parse(raw);
}

/** Parses URL search params against a schema. */
export function parseSearchParams<S extends z.ZodTypeAny>(url: string, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v !== "undefined" && v !== "null")
  );
  return schema.parse(cleaned);
}
