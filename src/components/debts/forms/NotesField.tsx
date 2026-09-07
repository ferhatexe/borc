"use client";

import { NotePencil } from "@phosphor-icons/react";

/**
 * Borç notu.
 *
 * Beş borç formunun da `notes` durumu ve gönderdiği alanı vardı ama onu
 * dolduracak bir girdi hiç konmamıştı: kullanıcı borç eklerken not yazamıyor,
 * alan her zaman boş gidiyordu. (Bu yüzden QNB kredilerinin notlarını
 * uygulamadan değil API'den yazmak zorunda kaldık.)
 *
 * Tek bileşen olarak duruyor ki beş form da aynı görünsün ve biri değişince
 * ötekiler geride kalmasın.
 */
export function NotesField({
  value,
  onChange,
  placeholder = "Kredi numarası, şube, sigorta, kimin adına olduğu…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor="borc-notu"
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-300"
      >
        <NotePencil size={14} className="text-zinc-400" />
        Not (Opsiyonel)
      </label>
      <textarea
        id="borc-notu"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        className="w-full resize-y rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-xs leading-relaxed text-white focus:border-emerald-500 focus:outline-none"
      />
      <p className="mt-1 text-[10px] text-zinc-500">
        Bankadaki karşılığını bulmanızı kolaylaştıran her şey: sözleşme no, şube,
        sigorta primi, yıllık maliyet oranı.
      </p>
    </div>
  );
}
