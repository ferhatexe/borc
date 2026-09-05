"use client";

import {
  Bank,
  CreditCard,
  Vault,
  Coins,
  UsersThree,
  Scroll,
  CalendarCheck,
  DotsThreeCircle,
  CheckCircle,
} from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";

export interface DebtTypeOption {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  badge?: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const DEBT_TYPES: DebtTypeOption[] = [
  {
    id: "TAKSITLI_KREDI",
    title: "Taksitli Kredi",
    subtitle: "İhtiyaç, Taşıt, Konut, KOBİ",
    description: "Aylık eşit taksitli veya serbest ödemeli banka kredisi planı.",
    icon: Bank,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "hover:border-emerald-500/40 border-emerald-500/20",
    badge: "Popüler",
  },
  {
    id: "KREDI_KARTI",
    title: "Kredi Kartı",
    subtitle: "Ekstre & Asgari Ödeme",
    description: "Dönem borcu, asgari ödeme tutarı ve hesap kesim günü takibi.",
    icon: CreditCard,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "hover:border-blue-500/40 border-blue-500/20",
  },
  {
    id: "EK_HESAP_KMH",
    title: "KMH / Ek Hesap",
    subtitle: "Artı Para & Günlük Faiz",
    description: "Kullanılan eksi bakiye üzerinden günlük işleyen faiz maliyeti.",
    icon: Vault,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "hover:border-amber-500/40 border-amber-500/20",
    badge: "Günlük Faiz",
  },
  {
    id: "ALTIN_BORCU",
    title: "Altın Borcu",
    subtitle: "Gram, Çeyrek, 21k Halep, 22k",
    description: "Canlı serbest piyasa kuru ve ayar marjı (+200 TL/gr) ile dinamik takip.",
    icon: Coins,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "hover:border-yellow-500/40 border-yellow-500/20",
    badge: "Canlı Kur",
  },
  {
    id: "KISI_BORCU",
    title: "Kişi Borcu",
    subtitle: "Eş, Dost, Akraba, İş Ortağı",
    description: "Şahıslardan alınan elden borçlar, vadesi ve faiz durumu.",
    icon: UsersThree,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "hover:border-purple-500/40 border-purple-500/20",
  },
  {
    id: "SENET_CEK",
    title: "Senet / Çek",
    subtitle: "Vadeli Kıymetli Evrak",
    description: "Vade tarihi, evrak numarası ve keşideci bazlı ticari evrak takibi.",
    icon: Scroll,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "hover:border-cyan-500/40 border-cyan-500/20",
  },
  {
    id: "DUZENLI_ODEME",
    title: "Düzenli Ödeme",
    subtitle: "Kira, Aidat, Abonelik",
    description: "Aylık veya periyodik tekrarlayan zorunlu ödeme yükümlülükleri.",
    icon: CalendarCheck,
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "hover:border-rose-500/40 border-rose-500/20",
  },
  {
    id: "DIGER",
    title: "Diğer Yükümlülük",
    subtitle: "Serbest Tanımlı",
    description: "Yukarıdaki kategorilere uymayan özel borç veya taahhüt kayıtları.",
    icon: DotsThreeCircle,
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    borderColor: "hover:border-zinc-500/40 border-zinc-500/20",
  },
];

interface DebtTypeSelectorProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

export function DebtTypeSelector({ selectedType, onSelect }: DebtTypeSelectorProps) {
  const handleSelect = (id: string) => {
    triggerHaptic("selection");
    onSelect(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          1. Borç Türünü Seçin
        </label>
        <span className="text-[11px] text-zinc-500">8 Farklı Borç Tipi</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DEBT_TYPES.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedType === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`relative flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-zinc-900/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.15)]"
                  : "bg-zinc-900/40 border-white/10 hover:bg-zinc-900/70 hover:border-white/20"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform ${
                  item.bgColor
                } ${item.color} ${isSelected ? "scale-105" : ""}`}
              >
                <Icon size={24} weight={isSelected ? "fill" : "duotone"} />
              </div>

              <div className="min-w-0 flex-1 pr-5">
                <div className="flex items-center gap-2">
                  <h4 className={`text-sm font-semibold ${isSelected ? "text-white" : "text-zinc-200"}`}>
                    {item.title}
                  </h4>
                  {item.badge && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-zinc-400 mt-0.5 truncate">{item.subtitle}</p>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>

              {isSelected && (
                <div className="absolute top-3.5 right-3.5 text-emerald-400 animate-in fade-in zoom-in-75">
                  <CheckCircle size={20} weight="fill" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
