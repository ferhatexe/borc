/**
 * "(44 gr)" / "(2 Adet)" gibi parantezli miktarı başlıkta yeni değerle değiştirir.
 *
 * Altın borcunun başlığı miktarı da taşıyor ("21 Ayar Halep Zinciri (44 gr)").
 * Gram ödemesinden sonra başlık eskide kalıyordu; ödeme bu fonksiyonla günceller.
 * Başlıkta parantezli miktar yoksa başlık olduğu gibi döner.
 */
export function withAmountInTitle(title: string, amount: number): string {
  const formatted = amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return title.replace(
    /\((\d+(?:[.,]\d+)?)\s*(gr|g|gram|adet)\)/i,
    (_m, _n, unit: string) => `(${formatted} ${unit})`
  );
}
