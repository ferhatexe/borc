/**
 * Sayfanın arkasında yavaşça sürüklenen ışık lekeleri.
 *
 * Tamamı CSS (bkz. globals.css `.aurora`): JavaScript çalışmaz, yalnızca
 * `transform` animasyonu vardır, o yüzden compositor katmanında döner ve
 * kaydırmayı yavaşlatmaz. `prefers-reduced-motion` açıkken genel kural
 * animasyonu durdurur; lekeler sabit bir degradeye dönüşür, kaybolmaz.
 *
 * `aria-hidden`: tamamen dekoratif, ekran okuyucuya bir şey söylemez.
 */
export function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora__blob aurora__blob--1" />
      <span className="aurora__blob aurora__blob--2" />
      <span className="aurora__blob aurora__blob--3" />
      <span className="aurora__grid" />
    </div>
  );
}
