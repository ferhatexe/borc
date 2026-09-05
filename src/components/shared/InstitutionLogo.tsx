import { memo } from "react";

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

function Motif({ motif, opacity }: { motif: InstitutionMotif; opacity: number }) {
  const stroke = { stroke: "currentColor", fill: "none", strokeWidth: 3, strokeLinecap: "round" as const };

  switch (motif) {
    case "arch":
      return (
        <g opacity={opacity}>
          <path d="M14 44V27a14 14 0 0 1 28 0v17" {...stroke} />
          <path d="M22 44V28a6 6 0 0 1 12 0v16" {...stroke} strokeWidth={2} />
        </g>
      );
    case "columns":
      return (
        <g opacity={opacity}>
          <path d="M11 24 28 13l17 11" {...stroke} />
          <path d="M17 27v15M28 27v15M39 27v15" {...stroke} strokeWidth={2.5} />
          <path d="M12 45h32" {...stroke} />
        </g>
      );
    case "chevron":
      return (
        <g opacity={opacity}>
          <path d="M12 38l10-11 8 8 14-16" {...stroke} strokeLinejoin="round" />
          <path d="M36 19h9v9" {...stroke} strokeLinejoin="round" />
        </g>
      );
    case "orbit":
      return (
        <g opacity={opacity}>
          <circle cx="28" cy="28" r="8" {...stroke} strokeWidth={2.5} />
          <ellipse cx="28" cy="28" rx="18" ry="8" transform="rotate(-28 28 28)" {...stroke} strokeWidth={2} />
        </g>
      );
    case "vault":
      return (
        <g opacity={opacity}>
          <rect x="12" y="14" width="32" height="28" rx="5" {...stroke} strokeWidth={2.5} />
          <circle cx="28" cy="28" r="7" {...stroke} strokeWidth={2.5} />
          <path d="M28 17v4M28 35v4M17 28h4M35 28h4" {...stroke} strokeWidth={2} />
        </g>
      );
    case "wave":
      return (
        <g opacity={opacity}>
          <path d="M10 32c6-9 12-9 18 0s12 9 18 0" {...stroke} />
          <path d="M10 41c6-9 12-9 18 0s12 9 18 0" {...stroke} strokeWidth={2} opacity={0.7} />
        </g>
      );
    case "diamond":
      return (
        <g opacity={opacity}>
          <path d="M28 11 45 28 28 45 11 28z" {...stroke} strokeLinejoin="round" />
          <path d="M28 20 36 28l-8 8-8-8z" {...stroke} strokeWidth={2} strokeLinejoin="round" />
        </g>
      );
    case "grid":
    default:
      return (
        <g opacity={opacity}>
          <rect x="12" y="12" width="14" height="14" rx="3" {...stroke} strokeWidth={2.5} />
          <rect x="30" y="12" width="14" height="14" rx="3" {...stroke} strokeWidth={2.5} />
          <rect x="12" y="30" width="14" height="14" rx="3" {...stroke} strokeWidth={2.5} />
          <circle cx="37" cy="37" r="7" {...stroke} strokeWidth={2.5} />
        </g>
      );
  }
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
  const tint = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#71717a";
  const motif = motifFor(name, type);
  const initials = initialsFor(name);
  const textOnLight = isLight(tint);
  const gradientId = `il-${hash(name + tint).toString(36)}`;

  return (
    <svg
      viewBox="0 0 56 56"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${name} rozeti`}
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tint} stopOpacity="0.95" />
          <stop offset="100%" stopColor={tint} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="56" height="56" rx="15" fill={`url(#${gradientId})`} />
      {/* Üstten gelen ince ışık: koyu temada rozeti zeminden ayırır. */}
      <rect
        x="0.75"
        y="0.75"
        width="54.5"
        height="54.5"
        rx="14.25"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />

      <g color={textOnLight ? "#09090b" : "#ffffff"}>
        <Motif motif={motif} opacity={motifOnly ? 0.9 : 0.28} />

        {!motifOnly && (
          <text
            x="28"
            y="29"
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            fontSize="21"
            fontWeight="700"
            letterSpacing="0.5"
            fontFamily="var(--font-inter), system-ui, sans-serif"
          >
            {initials}
          </text>
        )}
      </g>
    </svg>
  );
});
