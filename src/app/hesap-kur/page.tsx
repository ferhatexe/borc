import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

/** Yeni hesabın tek kullanımlık kurulum sayfası: /hesap-kur?t=<belirteç> */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return <SetupForm token={typeof t === "string" ? t : ""} />;
}
