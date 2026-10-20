import Decimal from "decimal.js";
import { addDays, endOfMonth, startOfMonth } from "date-fns";
import type { DebtWithRelations } from "@/lib/db/debts";
import type { AppSettings } from "@/lib/settings/defaults";
import type { GoldSyncResult } from "@/lib/gold/types";
import { calculateGoldDebtLiveTL } from "@/lib/gold/goldService";
import {
  calculateCreditCardOverdueInterest,
  calculateOverdraftInterest,
  daysSinceLastCharge,
} from "./overdraft";

export interface DebtValuation {
  id: string;
  title: string;
  type: string;
  status: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionColor: string | null;
  currency: string;

  /** Everything owed today, in TL. */
  outstandingTL: number;
  /** Principal only, before accrued interest. */
  principalTL: number;
  /** Interest that has accrued but has not been charged yet (KMH, cards). */
  accruedInterestTL: number;
  /** TL accruing every day at the current balance. */
  dailyAccrualTL: number;
  /**
   * Faizin hangi tarihten beri işlediği. Taksitli kredide son geçen taksit
   * vadesi (veya bankadan girilen bakiyenin tarihi), KMH'de son faiz kesim
   * tarihi. Kapama tutarının neden büyüdüğünü ekranda açıklamak için.
   */
  accrualSince: string | null;
  /** accrualSince'ten bugüne geçen gün sayısı. */
  accrualDays: number;
  /** Borç TL değilse kullanılan kur; TL ise 1. */
  fxRateToTRY: number;

  monthlyInterestRatePercent: number | null;
  installmentAmountTL: number | null;
  /** Kalan anapara kullanıcı tarafından mı verildi? */
  principalIsManual: boolean;
  principalOverrideAt: string | null;
  remainingInstallments: number | null;
  paidInstallments: number | null;
  totalInstallments: number | null;
  paymentDayOfMonth: number | null;

  /** Amount actually due within the current calendar month, unpaid only. */
  dueThisMonthTL: number;
  nextDueDate: string | null;
  isOverdue: boolean;

  goldDetail: {
    goldType: string;
    quantity: number | null;
    grams: number | null;
    karat: number | null;
    unitPriceWithPremiumTL: number;
    goldName: string;
    isPiece: boolean;
  } | null;

  overdraftDetail: {
    limit: number;
    usedAmount: number;
    utilizationPercent: number;
    accrualDays: number;
    lastInterestChargeDate: string | null;
  } | null;

  cardDetail: {
    creditLimit: number;
    statementBalance: number;
    minimumPayment: number;
    statementDay: number | null;
    dueDay: number | null;
    utilizationPercent: number;
    installmentsOnCardMonthlyTL: number;
  } | null;
}

export interface UpcomingPayment {
  debtId: string;
  installmentId: string | null;
  title: string;
  institutionName: string | null;
  /** Brand tint so list badges match the dashboard breakdown. */
  institutionColor: string | null;
  institutionType: string | null;
  debtType: string;
  amountTL: number;
  dueDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
  kind: "TAKSIT" | "KART" | "DUZENLI" | "SENET" | "ALTIN" | "KISI";
}

export interface InstitutionBreakdown {
  institutionId: string;
  institutionName: string;
  color: string;
  debtCount: number;
  totalOutstandingTL: number;
  monthlyObligationTL: number;
  debts: Array<{
    id: string;
    title: string;
    type: string;
    outstandingTL: number;
    /** Anapara ve işleyen faiz ayrı ayrı; rapordaki kırılım için. */
    principalTL: number;
    accruedInterestTL: number;
    dailyAccrualTL: number;
    currency: string;
    dueThisMonthTL: number;
    monthlyInterestRatePercent: number | null;
    remainingInstallments: number | null;
    totalInstallments: number | null;
    paymentDayOfMonth: number | null;
    installmentAmountTL: number | null;
    nextDueDate: string | null;
    isOverdue: boolean;
  }>;
}

export interface PortfolioSummary {
  valuations: DebtValuation[];
  totalDebtTL: number;
  totalAccruedInterestTL: number;
  totalDailyAccrualTL: number;
  /** Live TL value of every gold debt, so the UI can re-price it on a new rate. */
  goldDebtTL: number;
  dueThisMonthTL: number;
  overdueTL: number;
  institutionBreakdown: InstitutionBreakdown[];
  upcomingPayments: UpcomingPayment[];
  /** Everything already past its due date and still unpaid, oldest first. */
  overduePayments: UpcomingPayment[];
  overdueCount: number;
  /** Days the oldest unpaid item is late by; 0 when nothing is overdue. */
  worstOverdueDays: number;
}

/**
 * Bir borcun para biriminden TL'ye çevrim katsayısı.
 *
 * Döviz cinsi borçlar TL'ye çevrilmeden toplanıyordu: 1.000 $ borç toplamda
 * 1.000 TL gibi sayılıyordu. Kur yoksa çevrim yapılmaz ve tutar olduğu gibi
 * bırakılır - uydurma bir kur kullanmaktansa eksik göstermek yeğdir; arayüz
 * zaten fiyat/kur uyarısını gösteriyor.
 */
function fxRateToTRY(currency: string, gold: GoldSyncResult | null): number {
  if (!currency || currency === "TRY") return 1;
  // XAU (altın) ayrı yoldan, gram/adet üzerinden değerlenir.
  if (currency === "XAU") return 1;

  const quote = gold?.currencies.find((c) => c.code === currency);
  return quote && quote.sellPrice > 0 ? quote.sellPrice : 1;
}

const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : null;
};

/** Sum of the monthly instalments sitting on a credit card. */
function cardInstallmentMonthly(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((sum, item) => {
    const rec = item as { monthlyAmount?: unknown; remainingInstallments?: unknown };
    const remaining = Number(rec?.remainingInstallments ?? 0);
    if (!Number.isFinite(remaining) || remaining <= 0) return sum;
    const monthly = Number(rec?.monthlyAmount ?? 0);
    return Number.isFinite(monthly) ? sum + monthly : sum;
  }, 0);
}

/** Advances a recurring payment date until it is on or after `from`. */
function nextRecurringDate(start: Date, frequency: string | null, from: Date): Date {
  const stepMonths =
    frequency === "YILLIK" ? 12 : frequency === "ALTI_AYLIK" ? 6 : frequency === "UC_AYLIK" ? 3 : 1;

  const next = new Date(start);
  let guard = 0;
  while (next < from && guard < 600) {
    next.setMonth(next.getMonth() + stepMonths);
    guard += 1;
  }
  return next;
}

/**
 * Turns raw debt rows into the numbers every screen shows.
 *
 * KMH and overdue credit-card interest is accrued from the last charge date to
 * today and INCLUDED in the outstanding total, so the dashboard figure is what
 * the user would actually have to pay.
 */
export function valuateDebt(
  debt: DebtWithRelations,
  gold: GoldSyncResult | null,
  settings: AppSettings,
  now: Date = new Date()
): DebtValuation {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let principalTL = 0;
  let accruedInterestTL = 0;
  let dailyAccrualTL = 0;
  let dueThisMonthTL = 0;
  let nextDueDate: Date | null = null;
  let isOverdue = false;

  let accrualSince: Date | null = null;
  let accrualDays = 0;

  let goldDetail: DebtValuation["goldDetail"] = null;
  let overdraftDetail: DebtValuation["overdraftDetail"] = null;
  let cardDetail: DebtValuation["cardDetail"] = null;

  const schedules = debt.installmentSchedules ?? [];
  const pending = schedules.filter((s) => s.status !== "ODENDI");
  const paidCount = schedules.length - pending.length;

  switch (debt.type) {
    case "TAKSITLI_KREDI": {
      // remainingPrincipal on a row is the balance AFTER that instalment, so the
      // balance owed today is that plus the row's own principal share.
      if (pending.length > 0) {
        const first = pending[0];
        principalTL = num(first.remainingPrincipal) + num(first.principalPart);
      } else if (schedules.length === 0) {
        principalTL = num(debt.principal);
      }

      /*
       * Kullanıcı bankadaki güncel kalan anaparayı girdiyse o kazanır.
       * Erken ödeme, kısmi ödeme, dosya masrafı ve sigorta yüzünden amortisman
       * tablosu bankanın rakamını birebir tutturamaz; bu alan o farkı kapatır.
       * Plan yine taksit tarihleri ve tutarları için kullanılmaya devam eder.
       */
      const override = numOrNull(debt.currentPrincipalOverride);
      const hasOverride = override !== null && override >= 0;
      if (hasOverride) principalTL = override;

      /*
       * Taksit arasında da faiz işler.
       *
       * Kalan anapara bir sonraki taksite kadar sabit kalır ama bugün kapatmak
       * isterseniz banka son taksitten bugüne işlemiş faizi de ister. Yani
       * kapama tutarı her gün artar, taksit ödenince anapara düşüp faiz sıfırdan
       * başlar. Toplam borç bu yüzden plandaki sabit rakamı değil bugünkü kapama
       * tutarını yansıtır.
       *
       * Faiz saymaya nereden başlıyoruz:
       *   1. Bankadaki güncel bakiye girildiyse onun girildiği tarihten
       *      (o rakam zaten o güne kadarki faizi içerir, iki kez saymayalım),
       *   2. yoksa en son ÖDENEN taksitin tarihinden - vadesi geldiği hâlde
       *      ödenmemiş taksitte faiz işlemeye devam eder,
       *   3. hiç taksit ödenmediyse kredinin başlangıcından.
       *
       * Oran olarak akdi faiz kullanılır; taksitin içindeki dosya masrafı ve
       * sigorta faiz değildir, kapamada tahsil edilmez.
       */
      const loanRatePercent = num(debt.interestRateMonthly);
      if (principalTL > 0 && loanRatePercent > 0) {
        const lastPaidAt = schedules
          .filter((row) => row.status === "ODENDI")
          .map((row) => new Date(row.paidAt ?? row.dueDate))
          .filter((date) => date <= now)
          .sort((a, b) => b.getTime() - a.getTime())[0];

        accrualSince =
          hasOverride && debt.principalOverrideAt
            ? new Date(debt.principalOverrideAt)
            : (lastPaidAt ?? new Date(debt.startDate));

        accrualDays = daysSinceLastCharge(accrualSince, now);

        /*
         * Faizi taksiti aşan dönem (ana para payı 0): banka taksitte
         * tahsil edemediği faizi "biriken faiz" olarak sonraki taksite
         * devreder, yani bu dönemin faizi taksitin faiz payından büyüktür.
         * Burada tutar tavanı yanlış olur; faiz vade gününe kadar tam işler,
         * vade gününde durur.
         */
        const nextRow = pending[0];
        const carriesInterest = nextRow != null && num(nextRow.principalPart) <= 0;
        let stoppedAtDue = false;
        if (carriesInterest) {
          const daysToDue = daysSinceLastCharge(accrualSince, new Date(nextRow.dueDate));
          if (accrualDays >= daysToDue) {
            accrualDays = daysToDue;
            stoppedAtDue = true;
          }
        }

        const accrual = calculateOverdraftInterest({
          usedAmount: principalTL,
          monthlyInterestRatePercent: loanRatePercent,
          days: accrualDays,
          includeKKDF: debt.includeKKDF ?? true,
          kkdfRate: numOrNull(debt.kkdfRate) ?? settings.taxRates.kkdfRate,
          includeBSMV: debt.includeBSMV ?? true,
          bsmvRate: numOrNull(debt.bsmvRate) ?? settings.taxRates.bsmvRate,
        });

        accruedInterestTL = accrual.totalAccruedInterest.toNumber();
        dailyAccrualTL = stoppedAtDue ? 0 : accrual.dailyAccrual.toNumber();

        /*
         * Tavan: bir dönemde işleyen faiz, o dönemin sonundaki taksitin faiz
         * payını geçemez. Banka o taksitte zaten bu kadarını tahsil ediyor;
         * fazlası çift sayım olurdu. Tavan aynı zamanda kredi başlangıcı ile
         * ilk taksit arasında uzun boşluk olan kayıtları da korur.
         */
        const periodInterestCap = nextRow && !carriesInterest ? num(nextRow.interestPart) : 0;
        if (periodInterestCap > 0 && accruedInterestTL >= periodInterestCap) {
          accruedInterestTL = periodInterestCap;
          dailyAccrualTL = 0; // taksit gününe kadar daha fazla faiz işlemez
        }
      }

      for (const row of pending) {
        const due = new Date(row.dueDate);
        if (due >= monthStart && due <= monthEnd) dueThisMonthTL += num(row.totalAmount);
        if (due < now) isOverdue = true;
      }
      nextDueDate = pending[0] ? new Date(pending[0].dueDate) : null;
      break;
    }

    case "EK_HESAP_KMH": {
      const used = num(debt.usedAmount);
      const limit = num(debt.limit);
      const rate = num(debt.interestRateMonthly);
      const days = daysSinceLastCharge(debt.lastInterestChargeDate ?? debt.startDate, now);

      const accrual = calculateOverdraftInterest({
        usedAmount: used,
        monthlyInterestRatePercent: rate,
        days,
        includeKKDF: debt.includeKKDF ?? true,
        kkdfRate: numOrNull(debt.kkdfRate) ?? settings.taxRates.kkdfRate,
        includeBSMV: debt.includeBSMV ?? true,
        bsmvRate: numOrNull(debt.bsmvRate) ?? settings.taxRates.bsmvRate,
      });

      principalTL = used;
      accruedInterestTL = accrual.totalAccruedInterest.toNumber();
      dailyAccrualTL = accrual.dailyAccrual.toNumber();
      accrualSince = new Date(debt.lastInterestChargeDate ?? debt.startDate);
      accrualDays = days;
      // A revolving balance is payable in full at any time.
      dueThisMonthTL = used > 0 ? accruedInterestTL : 0;

      overdraftDetail = {
        limit,
        usedAmount: used,
        utilizationPercent: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
        accrualDays: days,
        lastInterestChargeDate: debt.lastInterestChargeDate
          ? new Date(debt.lastInterestChargeDate).toISOString()
          : null,
      };
      break;
    }

    case "KREDI_KARTI": {
      const balance = num(debt.currentStatementBalance);
      const limit = num(debt.creditLimit);
      const configuredMin = numOrNull(debt.minimumPayment);
      // Asgari yalnızca bilgi olarak tutulur (cardDetail); ödenecek olan kartın tamamı.
      const minimum =
        configuredMin ?? balance * settings.taxRates.creditCardMinPaymentRate;

      principalTL = balance;

      /*
       * Vade: bu ayın ödeme günü değil, SIRADAKİ ödeme günü.
       *
       * Eskiden bu ayın günü alınıyor, o gün geçmişse bakiye varken kart
       * doğrudan "gecikmiş" sayılıp gecikme faizi işletiliyordu. Oysa eldeki
       * bakiye çoğunlukla son ödemeden sonraki yeni harcamalardır ve bir sonraki
       * ödeme gününde ödenir: ayın 4'ünde ödenen kart 11'inde gecikmiş
       * görünüyor, toplam borca uydurma faiz ekleniyordu.
       *
       * Gecikme ancak şu durumda sayılır: son ödeme günü geçmiş, bakiye hâlâ
       * sıfırdan büyük ve kart o günden beri hiç güncellenmemiş - ne harcama, ne
       * ödeme, ne elle düzeltme. O günden sonra dokunulduysa bakiye yeni
       * dönemin borcudur. (Ödenmemiş dönemin üstüne yeni harcama eklenirse
       * gecikme gözden kaçabilir; uydurma faiz göstermektense bu tercih edildi.)
       */
      let prevDue: Date | null = null;
      let nextDue: Date | null = null;
      const day = debt.dueDay;
      if (day) {
        const dueIn = (year: number, month: number) => {
          const lastDay = new Date(year, month + 1, 0).getDate();
          return new Date(year, month, Math.min(day, lastDay));
        };
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisMonth = dueIn(now.getFullYear(), now.getMonth());
        if (thisMonth >= today) {
          nextDue = thisMonth;
          prevDue = dueIn(now.getFullYear(), now.getMonth() - 1);
        } else {
          prevDue = thisMonth;
          nextDue = dueIn(now.getFullYear(), now.getMonth() + 1);
        }
      }

      const lastTouched = debt.updatedAt ? new Date(debt.updatedAt) : null;
      if (balance > 0 && prevDue && lastTouched && lastTouched < prevDue) {
        const daysOverdue = Math.floor((now.getTime() - prevDue.getTime()) / 86400000);
        const interest = calculateCreditCardOverdueInterest({
          overdueBalance: balance,
          contractualMonthlyRatePercent: num(debt.contractualInterestMonthly),
          overdueMonthlyRatePercent: num(debt.overdueInterestMonthly),
          daysOverdue,
          includeKKDF: debt.includeKKDF ?? true,
          kkdfRate: numOrNull(debt.kkdfRate) ?? settings.taxRates.kkdfRate,
          includeBSMV: debt.includeBSMV ?? true,
          bsmvRate: numOrNull(debt.bsmvRate) ?? settings.taxRates.bsmvRate,
        });
        accruedInterestTL = interest.totalInterest.toNumber();
        dailyAccrualTL = daysOverdue > 0 ? accruedInterestTL / daysOverdue : 0;
        isOverdue = true;
      }

      // Kartın tamamı vadesinde ödenir; bu aya yalnızca vadesi bu ay olan ya da
      // gecikmiş bakiye girer.
      const dueDate = isOverdue ? prevDue : nextDue;
      const vadesiBuAy = dueDate !== null && dueDate >= monthStart && dueDate <= monthEnd;
      dueThisMonthTL = balance > 0 && (isOverdue || vadesiBuAy) ? balance : 0;
      nextDueDate = dueDate;

      cardDetail = {
        creditLimit: limit,
        statementBalance: balance,
        minimumPayment: minimum,
        statementDay: debt.statementDay,
        dueDay: debt.dueDay,
        utilizationPercent: limit > 0 ? Math.min(100, (balance / limit) * 100) : 0,
        installmentsOnCardMonthlyTL: cardInstallmentMonthly(debt.installmentsOnCard),
      };
      break;
    }

    case "ALTIN_BORCU": {
      if (gold && gold.prices.length > 0) {
        const valuation = calculateGoldDebtLiveTL(
          {
            goldType: debt.goldType ?? "DIGER",
            quantity: numOrNull(debt.quantity),
            grams: numOrNull(debt.grams),
            karat: debt.karat,
            premiumTL: numOrNull(debt.premiumTL),
            priceSource: debt.priceSource,
            manualUnitPrice: numOrNull(debt.manualUnitPrice),
          },
          gold.prices,
          gold.pureGramSellTL,
          { millesimalMap: settings.goldMillesimal, margins: settings.goldMargins }
        );

        principalTL = valuation.totalTL;
        goldDetail = {
          goldType: debt.goldType ?? "DIGER",
          quantity: numOrNull(debt.quantity),
          grams: numOrNull(debt.grams),
          karat: debt.karat,
          unitPriceWithPremiumTL: valuation.unitPriceWithPremiumTL,
          goldName: valuation.goldName,
          isPiece: valuation.isPiece,
        };
      } else {
        // No price available: report the recorded TL amount if there is one and
        // leave the rest at zero rather than inventing a rate.
        principalTL = num(debt.amount);
      }

      if (debt.dueDate) {
        nextDueDate = new Date(debt.dueDate);
        isOverdue = nextDueDate < now;
        if (nextDueDate >= monthStart && nextDueDate <= monthEnd) dueThisMonthTL = principalTL;
      }
      break;
    }

    case "DUZENLI_ODEME": {
      const amount = num(debt.amount);
      principalTL = amount;
      const base = debt.nextDueDate ? new Date(debt.nextDueDate) : new Date(debt.startDate);
      const next = nextRecurringDate(base, debt.frequency, monthStart);
      nextDueDate = next;
      isOverdue = base < now && base < monthStart;
      if (next >= monthStart && next <= monthEnd) dueThisMonthTL = amount;
      break;
    }

    case "KISI_BORCU": {
      const amount = num(debt.amount);
      principalTL = amount;

      if (debt.hasInterest && debt.interestRateMonthly) {
        const days = daysSinceLastCharge(debt.startDate, now);
        const accrual = calculateOverdraftInterest({
          usedAmount: amount,
          monthlyInterestRatePercent: num(debt.interestRateMonthly),
          days,
          includeKKDF: false,
          includeBSMV: false,
        });
        accruedInterestTL = accrual.totalAccruedInterest.toNumber();
        dailyAccrualTL = accrual.dailyAccrual.toNumber();
      }

      const plan = debt.installmentPlan as { installmentAmount?: number } | null;
      if (plan?.installmentAmount) dueThisMonthTL = Number(plan.installmentAmount) || 0;

      if (debt.dueDate) {
        nextDueDate = new Date(debt.dueDate);
        isOverdue = nextDueDate < now;
        if (!plan?.installmentAmount && nextDueDate >= monthStart && nextDueDate <= monthEnd) {
          dueThisMonthTL = amount;
        }
      }
      break;
    }

    default: {
      // SENET_CEK and DIGER
      const amount = num(debt.amount);
      principalTL = amount;
      if (debt.dueDate) {
        nextDueDate = new Date(debt.dueDate);
        isOverdue = nextDueDate < now;
        if (nextDueDate >= monthStart && nextDueDate <= monthEnd) dueThisMonthTL = amount;
      }
      break;
    }
  }

  if (debt.status === "KAPANDI") {
    dueThisMonthTL = 0;
    isOverdue = false;
  }

  /*
   * Döviz cinsi borçlar TL'ye çevrilir. Altın borcu bu adımın dışındadır:
   * o zaten gram/adet ve canlı altın fiyatı üzerinden TL olarak hesaplandı.
   */
  const fx = debt.type === "ALTIN_BORCU" ? 1 : fxRateToTRY(debt.currency, gold);
  if (fx !== 1) {
    principalTL *= fx;
    accruedInterestTL *= fx;
    dailyAccrualTL *= fx;
    dueThisMonthTL *= fx;
  }

  return {
    id: debt.id,
    title: debt.title,
    type: debt.type,
    status: debt.status,
    institutionId: debt.institutionId,
    institutionName: debt.institution?.name ?? null,
    institutionColor: debt.institution?.color ?? null,
    currency: debt.currency,

    fxRateToTRY: fx,
    accrualSince: accrualSince ? accrualSince.toISOString() : null,
    accrualDays,
    outstandingTL: round2(principalTL + accruedInterestTL),
    principalTL: round2(principalTL),
    accruedInterestTL: round2(accruedInterestTL),
    dailyAccrualTL: dailyAccrualTL,

    monthlyInterestRatePercent: numOrNull(debt.interestRateMonthly),
    installmentAmountTL: numOrNull(debt.installmentAmount),
    principalIsManual:
      debt.type === "TAKSITLI_KREDI" && numOrNull(debt.currentPrincipalOverride) !== null,
    principalOverrideAt: debt.principalOverrideAt
      ? new Date(debt.principalOverrideAt).toISOString()
      : null,
    remainingInstallments: schedules.length > 0 ? pending.length : null,
    paidInstallments: schedules.length > 0 ? paidCount : null,
    totalInstallments: schedules.length > 0 ? schedules.length : debt.installmentCount,
    paymentDayOfMonth: debt.paymentDayOfMonth,

    dueThisMonthTL: round2(dueThisMonthTL),
    nextDueDate: nextDueDate ? nextDueDate.toISOString() : null,
    isOverdue,

    goldDetail,
    overdraftDetail,
    cardDetail,
  };
}

/** Everything the dashboard needs, computed once from one debt list. */
export function buildPortfolioSummary(
  debts: DebtWithRelations[],
  gold: GoldSyncResult | null,
  settings: AppSettings,
  now: Date = new Date()
): PortfolioSummary {
  const valuations = debts.map((d) => valuateDebt(d, gold, settings, now));

  let totalDebtTL = new Decimal(0);
  let totalAccrued = new Decimal(0);
  let totalDaily = new Decimal(0);
  let dueThisMonth = new Decimal(0);
  let goldDebtTL = new Decimal(0);

  const instMap = new Map<string, InstitutionBreakdown>();

  for (const v of valuations) {
    totalDebtTL = totalDebtTL.plus(v.outstandingTL);
    totalAccrued = totalAccrued.plus(v.accruedInterestTL);
    totalDaily = totalDaily.plus(v.dailyAccrualTL);
    dueThisMonth = dueThisMonth.plus(v.dueThisMonthTL);
    if (v.type === "ALTIN_BORCU") goldDebtTL = goldDebtTL.plus(v.outstandingTL);

    // Debts without an institution are grouped instead of being dropped.
    const key = v.institutionId ?? "__none__";
    const entry = instMap.get(key) ?? {
      institutionId: key,
      institutionName: v.institutionName ?? "Kurumsuz / Kişisel",
      color: v.institutionColor ?? "#71717a",
      debtCount: 0,
      totalOutstandingTL: 0,
      monthlyObligationTL: 0,
      debts: [],
    };

    entry.debtCount += 1;
    entry.totalOutstandingTL = round2(entry.totalOutstandingTL + v.outstandingTL);
    entry.monthlyObligationTL = round2(entry.monthlyObligationTL + v.dueThisMonthTL);
    entry.debts.push({
      id: v.id,
      title: v.title,
      type: v.type,
      outstandingTL: v.outstandingTL,
      principalTL: v.principalTL,
      accruedInterestTL: v.accruedInterestTL,
      dailyAccrualTL: v.dailyAccrualTL,
      currency: v.currency,
      dueThisMonthTL: v.dueThisMonthTL,
      monthlyInterestRatePercent: v.monthlyInterestRatePercent,
      remainingInstallments: v.remainingInstallments,
      totalInstallments: v.totalInstallments,
      paymentDayOfMonth: v.paymentDayOfMonth,
      installmentAmountTL: v.installmentAmountTL,
      nextDueDate: v.nextDueDate,
      isOverdue: v.isOverdue,
    });

    instMap.set(key, entry);
  }

  const upcomingPayments = buildUpcomingPayments(debts, valuations, now);

  // "Ödemesi geçti" listesi: vadesi dolmuş ve hâlâ ödenmemiş her kalem.
  // En eski gecikme başta olacak şekilde sıralanır.
  const overduePayments = upcomingPayments
    .filter((p) => p.isOverdue)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const overdueTL = overduePayments.reduce(
    (sum, p) => sum.plus(p.amountTL),
    new Decimal(0)
  );
  const worstOverdueDays = overduePayments.length
    ? Math.abs(overduePayments[0].daysUntilDue)
    : 0;

  return {
    valuations,
    totalDebtTL: totalDebtTL.toDecimalPlaces(2).toNumber(),
    totalAccruedInterestTL: totalAccrued.toDecimalPlaces(2).toNumber(),
    totalDailyAccrualTL: totalDaily.toNumber(),
    goldDebtTL: goldDebtTL.toDecimalPlaces(2).toNumber(),
    dueThisMonthTL: dueThisMonth.toDecimalPlaces(2).toNumber(),
    overdueTL: overdueTL.toDecimalPlaces(2).toNumber(),
    institutionBreakdown: Array.from(instMap.values()).sort(
      (a, b) => b.totalOutstandingTL - a.totalOutstandingTL
    ),
    upcomingPayments,
    overduePayments,
    overdueCount: overduePayments.length,
    worstOverdueDays,
  };
}

/** Payments falling due in the next 30 days, plus anything already overdue. */
export function buildUpcomingPayments(
  debts: DebtWithRelations[],
  valuations: DebtValuation[],
  now: Date = new Date(),
  horizonDays = 30
): UpcomingPayment[] {
  const horizon = addDays(now, horizonDays);
  const byId = new Map(valuations.map((v) => [v.id, v]));
  const out: UpcomingPayment[] = [];

  const push = (
    debt: DebtWithRelations,
    dueDate: Date,
    amountTL: number,
    kind: UpcomingPayment["kind"],
    installmentId: string | null = null
  ) => {
    if (amountTL <= 0) return;
    // Anything already late stays in the list no matter how old it is.
    if (dueDate > horizon && dueDate >= now) return;
    out.push({
      debtId: debt.id,
      installmentId,
      title: debt.title,
      institutionName: debt.institution?.name ?? null,
      institutionColor: debt.institution?.color ?? debt.color ?? null,
      institutionType: debt.institution?.type ?? null,
      debtType: debt.type,
      amountTL: round2(amountTL),
      dueDate: dueDate.toISOString(),
      daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / 86400000),
      isOverdue: dueDate < now,
      kind,
    });
  };

  for (const debt of debts) {
    if (debt.status === "KAPANDI") continue;
    const v = byId.get(debt.id);
    if (!v) continue;

    if (debt.type === "TAKSITLI_KREDI") {
      for (const row of debt.installmentSchedules ?? []) {
        if (row.status === "ODENDI") continue;
        push(debt, new Date(row.dueDate), num(row.totalAmount), "TAKSIT", row.id);
      }
    } else if (v.nextDueDate) {
      const kind: UpcomingPayment["kind"] =
        debt.type === "KREDI_KARTI"
          ? "KART"
          : debt.type === "DUZENLI_ODEME"
            ? "DUZENLI"
            : debt.type === "SENET_CEK"
              ? "SENET"
              : debt.type === "ALTIN_BORCU"
                ? "ALTIN"
                : "KISI";
      push(debt, new Date(v.nextDueDate), v.dueThisMonthTL || v.outstandingTL, kind);
    }
  }

  return out.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
