import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getFullBackupJSON } from "@/lib/db/reports";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    const backup = await getFullBackupJSON(session.userId);
    const filename = `borcolcme_yedek_${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
