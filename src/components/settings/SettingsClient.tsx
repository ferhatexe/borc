"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bank,
  Coins,
  CurrencyDollar,
  DownloadSimple,
  FloppyDisk,
  Plus,
  Trash,
  UploadSimple,
  WarningCircle,
  Tag,
} from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";
import { formatDate } from "@/lib/formatters";
import { GOLD_TYPE_VALUES } from "@/lib/validation/debt";
import type { AppSettings } from "@/lib/settings/defaults";

const GOLD_LABELS: Record<string, string> = {
  GRAM_ALTIN: "Gram Altın",
  CEYREK: "Çeyrek Altın",
  YARIM: "Yarım Altın",
  TAM: "Tam Altın",
  ATA: "Ata Lira",
  GREMSE: "Gremse",
  BILEZIK_22: "22 Ayar Bilezik",
  ZINCIR_21_HALEP: "21 Ayar Halep Zinciri",
  BILEZIK_18: "18 Ayar",
  BILEZIK_14: "14 Ayar",
  KULCE: "Külçe / Has",
  DIGER: "Diğer",
};

const PIECE_TYPES = ["CEYREK", "YARIM", "TAM", "ATA", "GREMSE"];

interface CategoryRow {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
}

interface InstitutionRow {
  id: string;
  name: string;
  type: string;
  color: string | null;
  debtCount?: number;
}

interface SettingsClientProps {
  initialSettings: AppSettings;
  categories: CategoryRow[];
  institutions: InstitutionRow[];
  goldStatus: {
    source: string;
    sourceKind: string;
    fetchedAt: string;
    warning: string | null;
    pureGramSellTL: number;
  } | null;
}

export function SettingsClient({
  initialSettings,
  categories,
  institutions,
  goldStatus,
}: SettingsClientProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [saving, setSaving] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** PATCHes one or more setting keys and reports the outcome. */
  const save = async (label: string, body: Record<string, unknown>) => {
    setSaving(label);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ayar kaydedilemedi");

      triggerHaptic("success");
      toast.success(`${label} kaydedildi.`);
      router.refresh();
    } catch (err) {
      triggerHaptic("error");
      toast.error(err instanceof Error ? err.message : "Ayar kaydedilemedi");
    } finally {
      setSaving(null);
    }
  };

  // ----------------------------- kategoriler -----------------------------
  const [newCategory, setNewCategory] = useState({ name: "", type: "GIDER", parentId: "" });

  const addCategory = async () => {
    if (!newCategory.name.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory.name.trim(),
          type: newCategory.type,
          parentId: newCategory.parentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kategori eklenemedi");

      triggerHaptic("success");
      toast.success("Kategori eklendi.");
      setNewCategory({ name: "", type: "GIDER", parentId: "" });
      router.refresh();
    } catch (err) {
      triggerHaptic("error");
      toast.error(err instanceof Error ? err.message : "Kategori eklenemedi");
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" kategorisi silinsin mi?`)) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kategori silinemedi");
      toast.success("Kategori silindi.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kategori silinemedi");
    }
  };

  // ------------------------------- kurumlar ------------------------------
  const [newInstitution, setNewInstitution] = useState({ name: "", type: "BANKA" });

  const addInstitution = async () => {
    if (newInstitution.name.trim().length < 2) return;
    try {
      const res = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInstitution),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kurum eklenemedi");
      toast.success("Kurum eklendi.");
      setNewInstitution({ name: "", type: "BANKA" });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kurum eklenemedi");
    }
  };

  const deleteInstitution = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" kurumu silinsin mi?`)) return;
    try {
      const res = await fetch(`/api/institutions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kurum silinemedi");
      toast.success("Kurum silindi.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kurum silinemedi");
    }
  };

  // ------------------------------ yedekleme ------------------------------
  const [restoring, setRestoring] = useState(false);

  const restoreBackup = async (file: File, replace: boolean) => {
    setRestoring(true);
    try {
      const text = await file.text();
      const query = replace ? "?mode=replace&confirm=VERILERIMI_DEGISTIR" : "";
      const res = await fetch(`/api/reports/restore${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Geri yükleme başarısız");

      triggerHaptic("success");
      toast.success(data.message);
      if (data.report?.skipped?.length) {
        toast.warning(`${data.report.skipped.length} kayıt atlandı. Detay konsolda.`);
        console.warn("Geri yüklemede atlananlar:", data.report.skipped);
      }
      router.refresh();
    } catch (err) {
      triggerHaptic("error");
      toast.error(err instanceof Error ? err.message : "Geri yükleme başarısız");
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const incomeCategories = categories.filter((c) => c.type === "GELIR");
  const expenseParents = categories.filter((c) => c.type === "GIDER" && !c.parentId);

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Ayarlar</h1>
        <p className="text-xs text-zinc-400">
          Vergi oranları, altın marjları, kategoriler, kurumlar ve yedekleme
        </p>
      </div>

      {/* --------------------------- Vergi oranları --------------------------- */}
      <section className="glass-card p-5 space-y-4">
        <header className="flex items-center gap-2 text-emerald-400">
          <CurrencyDollar size={20} />
          <h2 className="text-sm font-semibold text-white">Vergi ve Oranlar</h2>
        </header>
        <p className="text-[11px] text-zinc-500">
          Bu oranlar kredi, KMH ve kredi kartı hesaplarının tamamında kullanılır. Yüzde değerini
          girin (örn. KKDF için 15).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              ["kkdfRate", "KKDF oranı"],
              ["bsmvRate", "BSMV oranı"],
              ["earlyPayoffPenaltyRate", "Erken kapama komisyonu"],
              ["creditCardMinPaymentRate", "Kart asgari ödeme oranı"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-xs text-zinc-300">{label} (%)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={Number((settings.taxRates[key] * 100).toFixed(4))}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    taxRates: { ...s.taxRates, [key]: Number(e.target.value) / 100 },
                  }))
                }
                className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={saving !== null}
          onClick={() => save("Vergi oranları", { tax_rates: settings.taxRates })}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          <FloppyDisk size={16} weight="bold" />
          {saving === "Vergi oranları" ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </section>

      {/* --------------------------- Altın marjları --------------------------- */}
      <section className="glass-card p-5 space-y-4">
        <header className="flex items-center gap-2 text-amber-400">
          <Coins size={20} />
          <h2 className="text-sm font-semibold text-white">Altın Marjları (TL)</h2>
        </header>
        <p className="text-[11px] text-zinc-500">
          Adet bazlı ürünlerde birim başına, gram bazlı ürünlerde gram başına eklenir. 21 ayar için
          varsayılan +200 ₺, 22 ayar bilezikte 0 ₺.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {GOLD_TYPE_VALUES.map((type) => (
            <label key={type} className="block">
              <span className="mb-1.5 block text-[11px] text-zinc-300">
                {GOLD_LABELS[type]}
                <span className="ml-1 text-zinc-500">
                  ({PIECE_TYPES.includes(type) ? "adet" : "gram"})
                </span>
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={settings.goldMargins[type] ?? 0}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    goldMargins: { ...s.goldMargins, [type]: Number(e.target.value) },
                  }))
                }
                className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={saving !== null}
          onClick={() => save("Altın marjları", { gold_margins: settings.goldMargins })}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          <FloppyDisk size={16} weight="bold" />
          {saving === "Altın marjları" ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </section>

      {/* ------------------- Milyem ve gram ağırlık tabloları ------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Milyem Tablosu</h2>
          <p className="text-[11px] text-zinc-500">
            Gram bazlı hesapta kullanılır: (gram × milyem × has altın) / 1000
          </p>
          <div className="grid grid-cols-5 gap-2">
            {(["14", "18", "21", "22", "24"] as const).map((karat) => (
              <label key={karat} className="block">
                <span className="mb-1 block text-[11px] text-zinc-300">{karat} ayar</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={settings.goldMillesimal[karat] ?? 0}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      goldMillesimal: { ...s.goldMillesimal, [karat]: Number(e.target.value) },
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-center font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => save("Milyem tablosu", { gold_karat_millesimal: settings.goldMillesimal })}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            <FloppyDisk size={16} /> Kaydet
          </button>
        </section>

        <section className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Ürün Gram Ağırlıkları</h2>
          <p className="text-[11px] text-zinc-500">Adet bazlı ürünlerin gram karşılıkları.</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(settings.goldUnitGrams).map((key) => (
              <label key={key} className="block">
                <span className="mb-1 block text-[11px] text-zinc-300">{GOLD_LABELS[key] ?? key}</span>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={settings.goldUnitGrams[key] ?? 0}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      goldUnitGrams: { ...s.goldUnitGrams, [key]: Number(e.target.value) },
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-center font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => save("Gram ağırlıkları", { gold_unit_grams: settings.goldUnitGrams })}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            <FloppyDisk size={16} /> Kaydet
          </button>
        </section>
      </div>

      {/* ----------------------- Manuel altın fiyatları ----------------------- */}
      <section className="glass-card p-5 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sky-400">
            <Coins size={20} />
            <h2 className="text-sm font-semibold text-white">Manuel Altın Fiyatları</h2>
          </div>
          <span className="text-[11px] text-zinc-500">
            {goldStatus
              ? `Şu anki kaynak: ${goldStatus.source} · ${formatDate(goldStatus.fetchedAt, "dd.MM.yyyy HH:mm")}`
              : "Canlı fiyat yok"}
          </span>
        </header>

        {goldStatus?.warning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
            <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
            <span>{goldStatus.warning}</span>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={settings.goldManualPrices.enabled}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                goldManualPrices: { ...s.goldManualPrices, enabled: e.target.checked },
              }))
            }
            className="h-4 w-4 rounded border-white/20 bg-zinc-800 text-sky-500"
          />
          <span className="text-xs text-zinc-200">
            Manuel fiyatları kullan (canlı servisin yerine geçer)
          </span>
        </label>

        <label className="block max-w-xs">
          <span className="mb-1.5 block text-xs text-zinc-300">Gram has altın satış (₺)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={settings.goldManualPrices.pureGramSellTL || ""}
            placeholder={goldStatus ? String(goldStatus.pureGramSellTL) : "0"}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                goldManualPrices: {
                  ...s.goldManualPrices,
                  pureGramSellTL: Number(e.target.value),
                },
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 font-mono text-xs text-white focus:border-sky-500 focus:outline-none"
          />
          <span className="mt-1 block text-[10px] text-zinc-500">
            Gram bazlı tüm hesapların temeli. Adet ürünlerini aşağıda ayrıca girebilirsiniz.
          </span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PIECE_TYPES.map((type) => (
            <label key={type} className="block">
              <span className="mb-1 block text-[11px] text-zinc-300">{GOLD_LABELS[type]} (₺)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.goldManualPrices.prices?.[type] ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    goldManualPrices: {
                      ...s.goldManualPrices,
                      prices: { ...s.goldManualPrices.prices, [type]: Number(e.target.value) },
                    },
                  }))
                }
                className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 font-mono text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={saving !== null}
          onClick={() => save("Manuel fiyatlar", { gold_manual_prices: settings.goldManualPrices })}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          <FloppyDisk size={16} weight="bold" />
          {saving === "Manuel fiyatlar" ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </section>

      {/* ------------------------------ Kategoriler ---------------------------- */}
      <section className="glass-card p-5 space-y-4">
        <header className="flex items-center gap-2 text-violet-400">
          <Tag size={20} />
          <h2 className="text-sm font-semibold text-white">Kategoriler</h2>
        </header>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[160px]">
            <span className="mb-1.5 block text-xs text-zinc-300">Kategori adı</span>
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory((c) => ({ ...c, name: e.target.value }))}
              placeholder="Örn: Evcil Hayvan"
              className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs text-zinc-300">Tür</span>
            <select
              value={newCategory.type}
              onChange={(e) => setNewCategory((c) => ({ ...c, type: e.target.value, parentId: "" }))}
              className="h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="GIDER">Gider</option>
              <option value="GELIR">Gelir</option>
            </select>
          </label>
          {newCategory.type === "GIDER" && (
            <label>
              <span className="mb-1.5 block text-xs text-zinc-300">Üst kategori</span>
              <select
                value={newCategory.parentId}
                onChange={(e) => setNewCategory((c) => ({ ...c, parentId: e.target.value }))}
                className="h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Ana kategori</option>
                {expenseParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={addCategory}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-violet-500 px-4 text-xs font-bold text-white transition hover:bg-violet-400"
          >
            <Plus size={14} weight="bold" /> Ekle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Gelir ({incomeCategories.length})
            </h3>
            <ul className="space-y-1">
              {incomeCategories.map((c) => (
                <CategoryItem key={c.id} category={c} onDelete={deleteCategory} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Gider ({categories.filter((c) => c.type === "GIDER").length})
            </h3>
            <ul className="space-y-1">
              {expenseParents.map((parent) => (
                <li key={parent.id}>
                  <CategoryItem category={parent} onDelete={deleteCategory} />
                  <ul className="ml-4 mt-1 space-y-1 border-l border-white/5 pl-2">
                    {categories
                      .filter((c) => c.parentId === parent.id)
                      .map((child) => (
                        <CategoryItem key={child.id} category={child} onDelete={deleteCategory} />
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------- Kurumlar ------------------------------ */}
      <section className="glass-card p-5 space-y-4">
        <header className="flex items-center gap-2 text-cyan-400">
          <Bank size={20} />
          <h2 className="text-sm font-semibold text-white">Kurumlar ({institutions.length})</h2>
        </header>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[160px]">
            <span className="mb-1.5 block text-xs text-zinc-300">Kurum adı</span>
            <input
              type="text"
              value={newInstitution.name}
              onChange={(e) => setNewInstitution((i) => ({ ...i, name: e.target.value }))}
              placeholder="Örn: Fibabanka"
              className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs text-zinc-300">Tür</span>
            <select
              value={newInstitution.type}
              onChange={(e) => setNewInstitution((i) => ({ ...i, type: e.target.value }))}
              className="h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="BANKA">Banka</option>
              <option value="KATILIM">Katılım</option>
              <option value="FINANSMAN">Finansman</option>
              <option value="KISI">Kişi</option>
              <option value="KURUM">Kurum</option>
              <option value="DIGER">Diğer</option>
            </select>
          </label>
          <button
            type="button"
            onClick={addInstitution}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-cyan-500 px-4 text-xs font-bold text-zinc-950 transition hover:bg-cyan-400"
          >
            <Plus size={14} weight="bold" /> Ekle
          </button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {institutions.map((inst) => (
            <li
              key={inst.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
            >
              <span className="truncate text-zinc-200">
                {inst.name}
                {(inst.debtCount ?? 0) > 0 && (
                  <span className="ml-1.5 text-zinc-500">({inst.debtCount} borç)</span>
                )}
              </span>
              <button
                type="button"
                aria-label={`${inst.name} kurumunu sil`}
                onClick={() => deleteInstitution(inst.id, inst.name)}
                className="shrink-0 text-zinc-500 transition hover:text-rose-400"
              >
                <Trash size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------ Yedekleme ------------------------------ */}
      <section className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Yedek Al / Geri Yükle</h2>
        <p className="text-[11px] text-zinc-500">
          Tüm borçlarınız, taksit planları, ödemeler, gelir/gider kayıtları, kategoriler ve
          ayarlarınız tek bir JSON dosyasına aktarılır.
        </p>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/reports/backup"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400"
          >
            <DownloadSimple size={16} weight="bold" /> Yedek indir (JSON)
          </a>

          <a
            href="/api/reports/export?type=debts"
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
          >
            <DownloadSimple size={16} /> Borçlar (CSV)
          </a>
          <a
            href="/api/reports/export?type=transactions"
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
          >
            <DownloadSimple size={16} /> Gelir/Gider (CSV)
          </a>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={restoring}
              onClick={() => {
                const file = fileInputRef.current?.files?.[0];
                if (!file) return toast.error("Önce bir yedek dosyası seçin.");
                restoreBackup(file, false);
              }}
              className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <UploadSimple size={16} />
                {restoring ? "Yükleniyor..." : "Ekleyerek geri yükle"}
              </span>
            </button>

            <button
              type="button"
              disabled={restoring}
              onClick={() => {
                const file = fileInputRef.current?.files?.[0];
                if (!file) return toast.error("Önce bir yedek dosyası seçin.");
                if (
                  window.confirm(
                    "Mevcut tüm borç, gelir ve gider kayıtlarınız silinip yedekteki verilerle değiştirilecek. Bu işlem geri alınamaz. Devam edilsin mi?"
                  )
                ) {
                  restoreBackup(file, true);
                }
              }}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              Değiştirerek geri yükle
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            &quot;Ekleyerek&quot; mevcut kayıtlarınızı korur ve yedektekileri üzerine ekler.
            &quot;Değiştirerek&quot; önce mevcut kayıtları siler.
          </p>
        </div>
      </section>
    </div>
  );
}

function CategoryItem({
  category,
  onDelete,
}: {
  category: CategoryRow;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs">
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: category.color ?? "#71717a" }}
        />
        <span className="truncate text-zinc-200">{category.name}</span>
        {category.isSystem && (
          <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-500">
            sistem
          </span>
        )}
      </span>
      {!category.isSystem && (
        <button
          type="button"
          aria-label={`${category.name} kategorisini sil`}
          onClick={() => onDelete(category.id, category.name)}
          className="shrink-0 text-zinc-500 transition hover:text-rose-400"
        >
          <Trash size={14} />
        </button>
      )}
    </li>
  );
}
