/**
 * Taksit ödemesinden sonra kalan anapara.
 *
 * Bankalar ödemeyi önce o güne kadar işlemiş faize, kalanını anaparaya sayar:
 *
 *   kalan = ödeme anındaki kapama tutarı (anapara + işlemiş faiz) - ödenen
 *
 * Erken ödemede de kural aynı. Vadesinden önce ödenen taksitte faizin
 * işlememiş kısmı alınmaz, ödenenin daha büyük kısmı anaparaya gider; taksit
 * plandakinden az ödenip anapara plandakinden fazla düşebilir. Plandaki anapara
 * payını düşmek bunu kaçırıyordu: 11.09.2026'daki QNB ödemesinde 15.690,88
 * çıkıyordu, banka 14.846,14 dedi.
 *
 * Kural kullanıcının gerçek QNB ödemelerini kuruşuna kadar veriyor (bkz. testler).
 */
export function principalAfterPayment(payoffBeforeTL: number, paymentTL: number): number {
  const kalan = Math.round((payoffBeforeTL - paymentTL) * 100) / 100;
  return kalan > 0 ? kalan : 0;
}
