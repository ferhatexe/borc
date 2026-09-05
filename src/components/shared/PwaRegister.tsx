"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("Service Worker başarıyla kaydedildi:", reg.scope);
          })
          .catch((err) => {
            console.warn("Service Worker kaydı başarısız:", err);
          });
      });
    }
  }, []);

  return null;
}
