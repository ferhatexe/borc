import { NextResponse } from "next/server";
import { KNOWN_APP_STORE_IDS } from "@/lib/institutions/brand";

export const runtime = "nodejs";

const DAY = 60 * 60 * 24;

/**
 * Bankanın resmî uygulamasının App Store simgesine yönlendirir.
 *
 * Apple'ın görsel adresi uygulama her güncellendiğinde değişir; bu yüzden
 * adres koda yazılmaz, App Store'un herkese açık arama servisinden uygulama
 * numarasıyla bir günlüğüne çözülür. Yalnızca bilinen banka uygulamaları ve
 * yalnızca Apple'ın görsel sunucusu kabul edilir.
 */
export async function GET(_req: Request, props: { params: Promise<{ app: string }> }) {
  const { app } = await props.params;
  const id = Number(app);
  if (!/^\d+$/.test(app) || !KNOWN_APP_STORE_IDS.has(id)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=tr`, {
      next: { revalidate: DAY },
    });
    if (!res.ok) throw new Error(`lookup ${res.status}`);
    const data = (await res.json()) as { results?: Array<{ artworkUrl512?: string }> };
    const url = data.results?.[0]?.artworkUrl512;
    if (!url || !/^https:\/\/[a-z0-9-]+\.mzstatic\.com\//.test(url)) throw new Error("simge yok");

    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": `public, max-age=${DAY}` },
    });
  } catch {
    // Rozet bu durumda bankanın sitesindeki logoya düşer.
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  }
}
