import { prisma } from "@/lib/prisma";
import { normalizeCoachState, type CoachState } from "@/lib/coach/streak";

/** Kumarsız gün serisinin saklandığı ayar anahtarı. */
export const COACH_STATE_KEY = "coach_state";

export async function getCoachState(userId: string): Promise<CoachState> {
  const row = await prisma.setting.findUnique({
    where: { userId_key: { userId, key: COACH_STATE_KEY } },
  });
  return normalizeCoachState(row?.value);
}

export async function saveCoachState(userId: string, state: CoachState): Promise<void> {
  const value = state as unknown as object;
  await prisma.setting.upsert({
    where: { userId_key: { userId, key: COACH_STATE_KEY } },
    update: { value },
    create: { userId, key: COACH_STATE_KEY, value },
  });
}
