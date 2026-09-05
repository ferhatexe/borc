import { it, expect } from "vitest";
import { toDateInputValue, parseDateInput, dayOfMonthFromInput } from "@/lib/formatters";
import { generateAmortizationSchedule } from "@/lib/finance/annuity";
import { formatDateTR } from "@/lib/formatters";

it("REGRESYON: 4 Ekim girilince plan 4 Ekim'den baslar", () => {
  // Kullanicinin senaryosu: bugun 5 Eylul, varsayilan ilk odeme 5 Ekim.
  const bugun = new Date(2026, 8, 5);
  const gelecekAy = new Date(bugun.getFullYear(), bugun.getMonth() + 1, bugun.getDate());
  const inputDegeri = toDateInputValue(gelecekAy);
  console.log("  varsayilan input degeri :", inputDegeri, "(beklenen 2026-10-05)");
  expect(inputDegeri).toBe("2026-10-05");

  // Kullanici 04.10.2026 secti
  const secilen = "2026-10-04";
  const gun = dayOfMonthFromInput(secilen);
  console.log("  secilen gun             :", gun, "(beklenen 4)");
  expect(gun).toBe(4);

  const plan = generateAmortizationSchedule({
    principal: 18550,
    monthlyInterestRatePercent: 5.45,
    installmentCount: 5,
    firstPaymentDate: parseDateInput(secilen)!,
    paymentDayOfMonth: gun!,
  });

  console.log("  plan vadeleri           :", plan.map((r) => formatDateTR(r.dueDate)).join(", "));
  expect(formatDateTR(plan[0].dueDate)).toBe("04.10.2026");
  expect(formatDateTR(plan[1].dueDate)).toBe("04.11.2026");
});

it("parseDateInput yerel gun dondurur, UTC kaymasi yok", () => {
  const d = parseDateInput("2026-10-04")!;
  expect(d.getFullYear()).toBe(2026);
  expect(d.getMonth()).toBe(9);
  expect(d.getDate()).toBe(4);
  expect(d.getHours()).toBe(0);
});

it("toDateInputValue gidis-donusu bozmaz", () => {
  for (const g of [1, 4, 5, 15, 28, 31]) {
    const d = new Date(2026, 0, g);
    expect(parseDateInput(toDateInputValue(d))!.getDate()).toBe(g);
  }
});
