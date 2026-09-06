import { THEME_STORAGE_KEY } from "./constants";

/**
 * Temayı ilk boyamadan önce `<html>` üzerine yazar.
 *
 * React hidrasyonu beklenirse açık temayı seçmiş kullanıcı her sayfa açılışında
 * bir kare koyu ekran görür. Bu yüzden kod senkron çalışan, engelleyici bir
 * script olarak `<head>`e konuyor - bu iş için standart yol budur.
 *
 * try/catch şart: gizli sekmede ya da site verisi kapalıyken `localStorage`
 * erişimin kendisi hata fırlatır ve script çökerse sayfa temasız kalır.
 */
export function ThemeScript() {
  const code = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
