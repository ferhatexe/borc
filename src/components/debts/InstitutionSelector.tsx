"use client";

import { useState, useEffect } from "react";
import {
  MagnifyingGlass,
  Plus,
  Check,
  Building,
  User,
} from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";
import { InstitutionLogo } from "@/components/shared/InstitutionLogo";

export interface Institution {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  code?: string | null;
}

interface InstitutionSelectorProps {
  selectedId?: string | null;
  onSelect: (institution: Institution | null) => void;
  debtType?: string;
}

export function InstitutionSelector({
  selectedId,
  onSelect,
  debtType,
}: InstitutionSelectorProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "BANKA" | "KATILIM" | "OTHER">("ALL");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInstName, setNewInstName] = useState("");
  const [newInstType, setNewInstType] = useState("BANKA");
  const [newInstColor, setNewInstColor] = useState("#10b981");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadInstitutions() {
      try {
        const res = await fetch("/api/institutions");
        if (res.ok) {
          const data = await res.json();
          setInstitutions(data);
        }
      } catch (e) {
        console.error("Kurumlar yüklenemedi", e);
      } finally {
        setLoading(false);
      }
    }
    loadInstitutions();
  }, []);

  const handleSelect = (inst: Institution | null) => {
    triggerHaptic("selection");
    onSelect(inst);
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newInstName.trim(),
          type: newInstType,
          color: newInstColor,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setInstitutions((prev) => [created, ...prev]);
        handleSelect(created);
        setShowAddModal(false);
        setNewInstName("");
        triggerHaptic("success");
      }
    } catch (err) {
      console.error("Kurum oluşturulamadı", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = institutions.filter((inst) => {
    const matchSearch =
      inst.name.toLowerCase().includes(search.toLowerCase()) ||
      (inst.code && inst.code.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;
    if (activeTab === "ALL") return true;
    if (activeTab === "BANKA") return inst.type === "BANKA";
    if (activeTab === "KATILIM") return inst.type === "KATILIM";
    if (activeTab === "OTHER") return inst.type !== "BANKA" && inst.type !== "KATILIM";
    return true;
  });

  const selectedInst = institutions.find((i) => i.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          2. Alacaklı / Kurum Seçimi
        </label>
        {debtType === "KISI_BORCU" ? (
          <span className="text-[11px] text-zinc-500">Şahıs veya Kurum</span>
        ) : (
          <span className="text-[11px] text-emerald-400 font-medium">Banka / Finansman Kuruluşu</span>
        )}
      </div>

      {/* Selected Institution Banner if any */}
      {selectedInst && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
              style={{ backgroundColor: selectedInst.color || "#059669" }}
            >
              {selectedInst.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">{selectedInst.name}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-medium">
                  {selectedInst.type}
                </span>
              </div>
              <p className="text-xs text-emerald-400">Seçili Kurum</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            Değiştir / Kaldır
          </button>
        </div>
      )}

      {/* Search & Tabs */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Banka veya kurum ara (örn. QNB, Garanti, Ziraat)..."
              className="w-full h-10 pl-10 pr-4 text-xs bg-zinc-900/60 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 transition-colors shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Yeni Kurum</span>
          </button>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/40 border border-white/5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "ALL" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tümü ({institutions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("BANKA")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "BANKA" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Mevduat Bankaları
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("KATILIM")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "KATILIM" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Katılım Bankaları
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("OTHER")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "OTHER" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Diğer / Şahıs
          </button>
        </div>
      </div>

      {/* Grid of institutions */}
      {loading ? (
        <div className="py-8 text-center text-xs text-zinc-500">Kurumlar listeleniyor...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {/* None / Custom option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
              selectedId === null || selectedId === undefined
                ? "bg-zinc-900 border-zinc-500 ring-1 ring-zinc-500/30"
                : "bg-zinc-900/30 border-white/5 hover:bg-zinc-900/60"
            }`}
          >
            <div className="h-8 w-8 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-300 truncate">Kurumsuz / Şahıs</p>
              <p className="text-[10px] text-zinc-500 truncate">Banka harici</p>
            </div>
          </button>

          {filtered.map((inst) => {
            const isSelected = selectedId === inst.id;
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => handleSelect(inst)}
                className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-zinc-900 border-emerald-500 ring-1 ring-emerald-500/40"
                    : "bg-zinc-900/30 border-white/5 hover:bg-zinc-900/60 hover:border-white/10"
                }`}
              >
                <InstitutionLogo name={inst.name} color={inst.color} type={inst.type} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{inst.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{inst.type}</p>
                </div>
                {isSelected && (
                  <Check size={16} weight="bold" className="text-emerald-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add Custom Institution Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building size={20} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">Yeni Kurum veya Banka Ekle</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCustom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Kurum / Banka / Kişi Adı *
                </label>
                <input
                  type="text"
                  required
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  placeholder="Örn: Kuveyt Türk, Enpara, Ahmet Bey..."
                  className="w-full h-10 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tür</label>
                  <select
                    value={newInstType}
                    onChange={(e) => setNewInstType(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BANKA">Mevduat Bankası</option>
                    <option value="KATILIM">Katılım Bankası</option>
                    <option value="FINANSMAN">Finansman Şirketi</option>
                    <option value="KISI">Şahıs / Bireysel</option>
                    <option value="KURUM">Diğer Kurum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Renk</label>
                  <div className="flex items-center gap-2 h-10">
                    <input
                      type="color"
                      value={newInstColor}
                      onChange={(e) => setNewInstColor(e.target.value)}
                      className="h-9 w-9 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs text-zinc-400">{newInstColor}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newInstName.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Kaydediliyor..." : "Kaydet ve Seç"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
