import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Düzenleme sırasında sessizce kaybolan alan kalmasın.
 *
 * `updateDebt` şemadaki alanların yalnızca bir kısmını yazıyordu: kart adı,
 * son dört hane, KKDF/BSMV bayrakları ve daha on tanesi. İstek 200 dönüyor,
 * değişiklik hiç kaydedilmiyordu - kullanıcı kaydettiğini sanıyordu.
 *
 * Bu test şemayı ve `updateDebt` gövdesini okuyup farkı alır. Şemaya yeni bir
 * alan eklenip `updateDebt`'e eklenmezse burası kırılır. Plan alanları bilerek
 * yazılmaz; onlar değişince kayıt kendi ödeme planıyla çelişeceği için istek
 * açıkça reddedilir (409), sessizce yutulmaz.
 */

const KOK = path.resolve(__dirname, "../../..");
const oku = (rel: string) => fs.readFileSync(path.join(KOK, rel), "utf8");

/** Ödeme planını baştan kurmayı gerektirdiği için düzenlemeyle değişemeyenler. */
const PLAN_ALANLARI = ["type", "installmentCount", "paidInstallments", "firstPaymentDate"];

function semaAlanlari(): string[] {
  const val = oku("src/lib/validation/debt.ts");
  const govde = val.slice(
    val.indexOf("const baseDebtSchema"),
    val.indexOf("export const createDebtSchema")
  );
  return [...govde.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s/gm)].map((m) => m[1]);
}

function updateDebtGovdesi(): string {
  const db = oku("src/lib/db/debts.ts");
  const bas = db.indexOf("export async function updateDebt");
  return db.slice(bas, db.indexOf("export async function", bas + 10));
}

function yazilanAlanlar(govde: string): Set<string> {
  return new Set([
    ...[...govde.matchAll(/assign\("([a-zA-Z0-9]+)"/g)].map((m) => m[1]),
    ...[...govde.matchAll(/input\.([a-zA-Z0-9]+) !== undefined/g)].map((m) => m[1]),
  ]);
}

describe("Borç güncelleme alan kapsamı", () => {
  it("şemadaki her alan ya yazılır ya da plan alanı olarak reddedilir", () => {
    const yazilan = yazilanAlanlar(updateDebtGovdesi());
    const kayip = semaAlanlari().filter(
      (alan) => !yazilan.has(alan) && !PLAN_ALANLARI.includes(alan)
    );
    expect(kayip).toEqual([]);
  });

  it("REGRESYON: kart adı ve son dört hane yazılır", () => {
    // Kartın bankası düzeltilirken bunlar sessizce eski değerinde kalıyordu.
    const yazilan = yazilanAlanlar(updateDebtGovdesi());
    expect(yazilan.has("cardName")).toBe(true);
    expect(yazilan.has("last4")).toBe(true);
  });

  it("vergi bayrakları yazılır; günlük faiz tahakkuku bunlara bakıyor", () => {
    const yazilan = yazilanAlanlar(updateDebtGovdesi());
    for (const alan of ["includeKKDF", "kkdfRate", "includeBSMV", "bsmvRate"]) {
      expect(yazilan.has(alan)).toBe(true);
    }
  });

  it("plan alanları farklı geldiğinde açıkça reddedilir", () => {
    const govde = updateDebtGovdesi();
    expect(govde).toContain("ConflictError");
    for (const alan of PLAN_ALANLARI) {
      expect(govde).toContain(`"${alan}"`);
    }
  });

  it("mevcut kayıt plan alanlarıyla birlikte okunur; yoksa karşılaştırma yapılamaz", () => {
    const govde = updateDebtGovdesi();
    expect(govde).toMatch(/installmentCount:\s*true/);
    expect(govde).toMatch(/firstPaymentDate:\s*true/);
  });
});
