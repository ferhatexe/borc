"use client";

import { memo, useState } from "react";
import { Bank, Buildings, Coins, DotsThreeOutline, User, type Icon } from "@phosphor-icons/react";
import { brandFor, brandLogoUrl } from "@/lib/institutions/brand";

/**
 * Original monogram badges for institutions.
 *
 * These are OUR OWN marks, not reproductions of any bank's logo. Real bank
 * logos are trademarks and cannot be redistributed with the app, so each
 * institution instead gets a deterministic geometric badge built from:
 *   - its brand colour (stored on the Institution row, editable in Ayarlar)
 *   - a motif chosen by hashing the name, so the same bank always looks the same
 *   - its initials
 *
 * Everything is inline SVG: no network request, sharp at any size, and it
 * inherits the page's dark theme.
 *
 * Bilinen bankalarda önce bankanın resmî uygulamasının simgesi, o yüklenemezse
 * sitesindeki logo ya da favicon (çalışma anında çekilir) gösterilir; hiçbiri
 * yüklenemezse bu rozet devreye girer.
 */

export type InstitutionMotif =
  | "arch"      // katılım / kemer
  | "columns"   // klasik banka
  | "chevron"   // yükselen çizgi
  | "orbit"     // dijital / fintech
  | "vault"     // kasa
  | "wave"      // akış
  | "diamond"   // değer
  | "grid";     // kurumsal

const MOTIFS: InstitutionMotif[] = [
  "arch",
  "columns",
  "chevron",
  "orbit",
  "vault",
  "wave",
  "diamond",
  "grid",
];

/** Institution type steers the motif family so a bank never looks like a person. */
const TYPE_MOTIFS: Record<string, InstitutionMotif[]> = {
  // Havuzlar geniş tutulur: dar bir havuz, çok sayıda banka arasında aynı
  // motifin tekrar etmesine ve liste satırlarının birbirine benzemesine yol açar.
  BANKA: ["columns", "chevron", "vault", "grid", "arch", "diamond", "orbit", "wave"],
  KATILIM: ["arch", "diamond", "wave", "columns", "grid"],
  FINANSMAN: ["orbit", "chevron", "wave", "diamond"],
  KISI: ["diamond", "orbit", "wave"],
  KURUM: ["grid", "columns", "vault"],
  DIGER: ["wave", "orbit", "diamond"],
};

/** Stable, order-independent string hash. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function motifFor(name: string, type?: string | null): InstitutionMotif {
  const pool = (type && TYPE_MOTIFS[type]) || MOTIFS;
  return pool[hash(name) % pool.length];
}

/** Up to two letters, Turkish-aware, skipping filler words and punctuation. */
export function initialsFor(name: string): string {
  const skip = new Set(["ve", "bank", "bankası", "bankasi", "as", "com", "türk", "turk"]);

  // Noktalama tamamen atılır: "Kurumsuz / Kişisel" gibi bir ad aksi hâlde
  // baş harf olarak "K/" üretiyordu.
  const words = name
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0 && !skip.has(w.toLocaleLowerCase("tr")));

  const source = words.length > 0 ? words : [name.replace(/[^\p{L}\p{N}]/gu, "") || "?"];
  if (source.length === 1) return source[0].slice(0, 2).toLocaleUpperCase("tr");
  return (source[0][0] + source[1][0]).toLocaleUpperCase("tr");
}

/** Readable text colour for a given badge tint. */
function isLight(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Perceived luminance (ITU-R BT.601)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export interface InstitutionLogoProps {
  name: string;
  /** Brand tint from the Institution row. Falls back to a neutral zinc. */
  color?: string | null;
  type?: string | null;
  /** Rendered pixel size; the SVG itself is always a 56x56 viewBox. */
  size?: number;
  /** Hide the initials and show only the motif. */
  motifOnly?: boolean;
  className?: string;
}

/**
 * Renders one institution badge. Deterministic: the same name always produces
 * the same mark, so the list stays visually stable between renders.
 */
export const InstitutionLogo = memo(function InstitutionLogo({
  name,
  color,
  type,
  size = 40,
  motifOnly = false,
  className,
}: InstitutionLogoProps) {
  // Sırayla: uygulama simgesi -> sitedeki logo / favicon -> baş harfler.
  const [failures, setFailures] = useState(0);
  const brand = brandFor(name);
  const hasAppIcon = Boolean(brand?.appIconUrl);
  const appIconFailed = !hasAppIcon || failures >= 1;
  const logoFailed = failures >= (hasAppIcon ? 2 : 1);
  const onLogoError = () => setFailures((n) => n + 1);

  if (brand?.appIconUrl && !appIconFailed && !motifOnly) {
    return (
      <span
        className={className}
        role="img"
        aria-label={`${name} logosu`}
        style={{
          display: "block",
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.27),
          border: "1px solid var(--line)",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- harici simge, optimize edilecek bir şey yok */}
        <img
          src={brand.appIconUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={onLogoError}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }

  if (brand?.wideLogo && !logoFailed && !motifOnly) {
    const inner = Math.round(size * 0.7);
    return (
      <span
        className={className}
        role="img"
        aria-label={`${name} logosu`}
        style={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.27),
          background: "#ffffff",
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}
      >
        {/* Yatay logonun yalnızca soldaki kare amblemi görünür. */}
        <span style={{ display: "block", width: inner, height: inner, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- harici logo, optimize edilecek bir şey yok */}
          <img
            src={brand.wideLogo.url}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={onLogoError}
            style={{
              display: "block",
              height: inner,
              width: Math.round(inner * brand.wideLogo.aspect),
              maxWidth: "none",
              marginLeft: -Math.round(inner * brand.wideLogo.aspect * (brand.wideLogo.offset ?? 0)),
            }}
          />
        </span>
      </span>
    );
  }

  if (brand?.domain && !logoFailed && !motifOnly) {
    const inner = Math.round(size * 0.68);
    return (
      <span
        className={className}
        role="img"
        aria-label={`${name} logosu`}
        style={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.27),
          background: "#ffffff",
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- harici favicon, optimize edilecek bir şey yok */}
        <img
          src={brandLogoUrl(brand.domain)}
          alt=""
          width={inner}
          height={inner}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onLogoError}
          style={{ width: inner, height: inner, objectFit: "contain" }}
        />
      </span>
    );
  }

  // Logosu olmayan kurum ya da kişi: yumuşak renkli kare üstünde sade simge.
  const tint = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#71717a";
  const kind = fallbackKind(name, type);
  const Icon = kind ? FALLBACK_ICONS[kind] : null;
  const initials = brand?.short ?? initialsFor(name);

  return (
    <span
      className={className}
      role="img"
      aria-label={`${name} simgesi`}
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        background: `${tint}1f`,
        border: `1px solid ${tint}33`,
        color: isLight(tint) ? "#3f3f46" : tint,
      }}
    >
      {Icon ? (
        <Icon size={Math.round(size * 0.52)} weight="duotone" />
      ) : (
        <span
          style={{
            fontSize: Math.round(size * (initials.length > 2 ? 0.3 : 0.36)),
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          {initials}
        </span>
      )}
    </span>
  );
});

type FallbackKind = "person" | "other" | "gold" | "company" | "bank";

const FALLBACK_ICONS: Record<FallbackKind, Icon> = {
  person: User,
  other: DotsThreeOutline,
  gold: Coins,
  company: Buildings,
  bank: Bank,
};

/** Adı ve türü hangi sade simgeyi alacağını söyler; bilinmeyen banka baş harfle kalır. */
export function fallbackKind(name: string, type?: string | null): FallbackKind | null {
  const n = name.toLocaleLowerCase("tr");
  if (/^di[gğ]er(\s|$)/.test(n)) return "other";
  if (/ki[sş]i|kurumsuz|şah[iı]s|sahis/.test(n)) return "person";
  if (/alt[iı]n|kuyumcu|ayar|bilezik|zincir/.test(n)) return "gold";
  if (type === "KISI") return "person";
  if (type === "DIGER") return "other";
  if (type === "ALTIN") return "gold";
  if (type === "KURUM") return "company";
  return null;
}
