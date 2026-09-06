import { THEME_STORAGE_KEY, DEFAULT_THEME } from "./constants";

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
  const code = `(function(){var d=${JSON.stringify(DEFAULT_THEME)};try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
document.documentElement.setAttribute("data-theme",(s==="light"||s==="dark")?s:d);
}catch(e){document.documentElement.setAttribute("data-theme",d);}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
