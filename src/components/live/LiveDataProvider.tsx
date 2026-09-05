"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLivePortfolio, type LivePortfolio } from "@/lib/hooks/useLivePortfolio";

const LiveDataContext = createContext<LivePortfolio | null>(null);

/**
 * One poll for the whole app.
 *
 * Mounted once in the root layout so the header strip, the summary cards, the
 * mobile nav badge and the overdue screen all read the same /api/live payload
 * instead of each fetching it. Pages that render server data first pass it as
 * their own fallback and switch over once this provider has fresher numbers.
 */
export function LiveDataProvider({
  children,
  isAuthenticated,
}: {
  children: ReactNode;
  /** Polling only runs for a signed-in user; otherwise every call would 401. */
  isAuthenticated: boolean;
}) {
  const live = useLivePortfolio(null, isAuthenticated);
  return <LiveDataContext.Provider value={live}>{children}</LiveDataContext.Provider>;
}

/** Returns null outside the provider, so components can fall back to props. */
export function useLiveData(): LivePortfolio | null {
  return useContext(LiveDataContext);
}
