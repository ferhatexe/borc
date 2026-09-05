import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { generateCSV } from "@/lib/db/reports";
import { errorResponse, parseSearchParams } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  type: z.enum(["debts", "transactions", "summary"]).default("summary"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { type } = parseSearchParams(req.url, querySchema);

    const csv = await generateCSV(session.userId, type);
    const filename = `borcolcme_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

    // UTF-8 BOM so Excel opens Turkish characters correctly.
    const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, "utf-8")]);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
