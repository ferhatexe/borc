"use client";

import { usePathname } from "next/navigation";

/**
 * Sayfa geçişi.
 *
 * `key` olarak yol verilir; Next yeni sayfayı bastığında React ağacı değişir ve
 * CSS animasyonu yeniden çalışır. Bu iş için `motion` yerine düz CSS tercih
 * edildi: geçiş her gezinmede tetiklendiği için animasyonun ana iş parçacığına
 * hiç uğramaması önemli.
 *
 * Çıkış animasyonu bilinçli olarak yok. App Router yeni sayfayı hazır olunca
 * basar; çıkışı beklemek gezinmeyi görünür biçimde yavaşlatır.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
