"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { numberToInputText, parseLocaleNumber, sanitizeNumberText } from "@/lib/parseNumber";

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "min" | "max" | "step" | "inputMode"
>;

export interface NumberFieldProps extends NativeProps {
  value: number | string | null | undefined;
  /**
   * `<input type="number">` ile aynı sözleşme: `e.target.value` nokta ondalıklı
   * bir sayı metnidir ("2435.5") ya da alan boşsa "". Mevcut
   * `Number(e.target.value)` işleyicileri değişmeden çalışır.
   */
  onChange: (e: { target: { value: string } }) => void;
  min?: number | string;
  max?: number | string;
  /** Gün, adet, taksit sayısı gibi alanlar: ondalık yazılamaz. */
  integer?: boolean;
}

/**
 * Sayı alanı.
 *
 * `type="number"` yerine kullanılır, çünkü o tip:
 *  - `step` yüzünden kuruşlu ya da yuvarlak olmayan tutarı reddediyordu
 *    (kredi tutarına 117.042,60 yazılamıyordu),
 *  - sayı tutan state ile birlikte boşaltılamıyor, 0'a takılıyordu,
 *  - telefonda virgüllü klavyeyi her zaman açmıyordu.
 *
 * Burada metin alanı + `inputMode` kullanılır; yazılan metin bileşende durur,
 * dışarıya çözülmüş sayı gider. Virgül de nokta da ondalık olarak kabul edilir.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  integer = false,
  onFocus,
  onBlur,
  ...rest
}: NumberFieldProps) {
  const [text, setText] = useState(() => numberToInputText(value));
  const ref = useRef<HTMLInputElement>(null);

  // Değer dışarıdan değişirse (form sıfırlama, otomatik hesap) metni eşitle;
  // kullanıcının yazmakta olduğu "12," gibi yarım metne dokunma.
  useEffect(() => {
    const external = value === null || value === undefined || value === "" ? null : Number(value);
    const current = parseLocaleNumber(text);
    const same =
      external === current || (external === 0 && current === null) || (external === null && current === 0);
    if (!same) setText(numberToInputText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const validate = (n: number | null) => {
    const el = ref.current;
    if (!el) return;
    let message = "";
    if (n !== null) {
      if (min !== undefined && min !== "" && n < Number(min)) message = `En az ${numberToInputText(Number(min))} olmalı`;
      if (max !== undefined && max !== "" && n > Number(max)) message = `En fazla ${numberToInputText(Number(max))} olabilir`;
    }
    el.setCustomValidity(message);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      enterKeyHint="done"
      value={text}
      onChange={(e) => {
        const next = sanitizeNumberText(e.target.value, integer);
        setText(next);
        const n = parseLocaleNumber(next);
        validate(n);
        onChange({ target: { value: n === null ? "" : String(n) } });
      }}
      onFocus={(e) => {
        // Telefonda mevcut tutarın üstüne yazmak tek dokunuş olsun.
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        // "12," ya da "1.250,5" gibi metni çözülmüş hâline toparla.
        const n = parseLocaleNumber(text);
        if (text !== "" && n !== null) setText(numberToInputText(n));
        validate(n);
        onBlur?.(e);
      }}
    />
  );
}
