import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "./debts";
import type { CreateCategoryInput } from "@/lib/validation/transaction";

/**
 * Categories live in the database only. The previous hardcoded SYSTEM_CATEGORIES
 * list used different ids AND different names than the seed, so any fallback to
 * it produced foreign-key failures on the next write.
 */

export const CATEGORY_INCLUDE = {
  children: { orderBy: { name: "asc" } },
} satisfies Prisma.CategoryInclude;

export type CategoryWithChildren = Prisma.CategoryGetPayload<{ include: typeof CATEGORY_INCLUDE }>;

export interface CategoryFilters {
  type?: "GELIR" | "GIDER";
  /** Only return top-level categories, with their children nested. */
  topLevelOnly?: boolean;
}

export async function getCategories(
  userId: string,
  filters: CategoryFilters = {}
): Promise<CategoryWithChildren[]> {
  return prisma.category.findMany({
    where: {
      OR: [{ userId }, { userId: null }],
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.topLevelOnly ? { parentId: null } : {}),
    },
    include: CATEGORY_INCLUDE,
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryById(userId: string, id: string) {
  return prisma.category.findFirst({
    where: { id, OR: [{ userId }, { userId: null }] },
    include: CATEGORY_INCLUDE,
  });
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput
): Promise<CategoryWithChildren> {
  if (input.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: input.parentId, type: input.type, OR: [{ userId }, { userId: null }] },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new NotFoundError("Üst kategori bulunamadı");
    if (parent.parentId) throw new ConflictError("Alt kategorinin altına kategori eklenemez");
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      userId,
      type: input.type,
      parentId: input.parentId ?? null,
      name: { equals: input.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError(`"${input.name}" kategorisi zaten mevcut`);

  return prisma.category.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      icon: input.icon ?? "Tag",
      color: input.color ?? "#10b981",
      parentId: input.parentId ?? null,
      isSystem: false,
    },
    include: CATEGORY_INCLUDE,
  });
}

export async function updateCategory(
  userId: string,
  id: string,
  input: Partial<CreateCategoryInput>
) {
  const existing = await prisma.category.findFirst({
    where: { id, userId },
    select: { id: true, isSystem: true },
  });
  if (!existing) throw new NotFoundError("Kategori bulunamadı");

  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
    include: CATEGORY_INCLUDE,
  });
}

/**
 * Categories are referenced by income and expense rows, so a category that is
 * in use cannot be removed - the caller is told to move those records first.
 */
export async function deleteCategory(userId: string, id: string) {
  const category = await prisma.category.findFirst({
    where: { id, userId },
    select: { id: true, isSystem: true, _count: { select: { incomes: true, expenses: true, children: true } } },
  });
  if (!category) throw new NotFoundError("Kategori bulunamadı");
  if (category.isSystem) throw new ConflictError("Sistem kategorileri silinemez");

  const { incomes, expenses, children } = category._count;
  if (incomes + expenses > 0) {
    throw new ConflictError(
      `Bu kategoriye bağlı ${incomes + expenses} kayıt var. Önce kayıtları başka kategoriye taşıyın.`
    );
  }
  if (children > 0) {
    throw new ConflictError("Önce alt kategorileri silmelisiniz.");
  }

  await prisma.category.delete({ where: { id } });
  return true;
}
