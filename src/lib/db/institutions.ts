import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "./debts";
import type { CreateInstitutionInput } from "@/lib/validation/transaction";

/**
 * The institution list is seeded into the database; there is no shadow copy in
 * code any more. `Institution.name` is unique at the schema level, so the same
 * bank cannot be added twice by accident.
 */

export interface InstitutionItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  logoUrl: string | null;
  debtCount?: number;
}

export async function getInstitutions(userId?: string): Promise<InstitutionItem[]> {
  const list = await prisma.institution.findMany({
    orderBy: { name: "asc" },
    include: userId
      ? { _count: { select: { debts: { where: { userId, isArchived: false } } } } }
      : undefined,
  });

  return list
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      color: item.color,
      logoUrl: item.logoUrl,
      debtCount: "_count" in item ? (item._count as { debts: number }).debts : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export async function createInstitution(input: CreateInstitutionInput): Promise<InstitutionItem> {
  const existing = await prisma.institution.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (existing) throw new ConflictError(`"${existing.name}" kurumu zaten kayıtlı`);

  const created = await prisma.institution.create({
    data: {
      name: input.name,
      type: input.type,
      color: input.color ?? "#10B981",
    },
  });

  return {
    id: created.id,
    name: created.name,
    type: created.type,
    color: created.color,
    logoUrl: created.logoUrl,
  };
}

export async function deleteInstitution(id: string) {
  const institution = await prisma.institution.findUnique({
    where: { id },
    select: { id: true, _count: { select: { debts: true } } },
  });
  if (!institution) throw new NotFoundError("Kurum bulunamadı");
  if (institution._count.debts > 0) {
    throw new ConflictError(
      `Bu kuruma bağlı ${institution._count.debts} borç kaydı var, önce onları taşıyın veya silin.`
    );
  }

  await prisma.institution.delete({ where: { id } });
  return true;
}
