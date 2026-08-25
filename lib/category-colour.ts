import type { Category } from '@/types'

/** Used wherever a task has no category, or its category has no colour. */
export const DEFAULT_CATEGORY_COLOUR = '#6B7280'

/**
 * The colour that represents a category in the UI.
 *
 * Subcategories inherit their top-level parent's colour, so a task tagged
 * "Family → Admin" shows the Family colour rather than a second one. That rule
 * was implemented separately in six components (TaskRow, HouseholdTaskRow,
 * DashboardTaskRow, CalendarClient, BrainDumpClient, RoleCategoryManager), with
 * small differences in how a missing category was handled.
 *
 * Returns null when there is no category to colour, so callers that hide the
 * indicator entirely can do so; callers that always want a swatch fall back to
 * DEFAULT_CATEGORY_COLOUR.
 */
export function categoryColour(
  categoryId: string | null | undefined,
  categories: Category[]
): string | null {
  if (!categoryId) return null

  const category = categories.find(c => c.id === categoryId)
  if (!category) return null

  const parent = category.parent_id
    ? categories.find(c => c.id === category.parent_id)
    : null

  return (parent ?? category).colour ?? null
}
