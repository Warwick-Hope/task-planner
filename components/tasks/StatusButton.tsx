'use client'

import { STATUS_DISPLAY } from '@/lib/task-status'
import type { TaskStatus } from '@/types'

/**
 * The status circle, in one component.
 *
 * The cycle and the icons were already shared (lib/task-status.ts, KB.md #24);
 * the *control* was not, and five components had their own copy of it. They had
 * drifted in the way copies do: four carried the 40px touch target the mobile
 * pass added and CleaningScheduleView's did not, and that one had no accessible
 * name either — a bare glyph, to a screen reader.
 *
 * `compact` is for the surfaces where a task is a chip rather than a row: the
 * calendar and the plan board, where a 40px target is taller than the chip it
 * sits in.
 *
 * It stops the pointer reaching anything above it. On both of those screens the
 * chip is a drag handle, and dnd-kit claims a `pointerdown` it can see — without
 * this, pressing the circle picks the task up instead of advancing it.
 */
export default function StatusButton({
  status,
  toggling,
  onToggle,
  compact = false,
  className = '',
}: {
  status: TaskStatus
  toggling: boolean
  onToggle: () => void
  compact?: boolean
  className?: string
}) {
  const { icon, className: statusClass } = STATUS_DISPLAY[status]

  const size = compact
    ? 'min-h-[24px] min-w-[20px] text-sm'
    : 'min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0 text-lg'

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      disabled={toggling}
      title={`Status: ${status}. Click to advance.`}
      aria-label={`Status: ${status}. Advance status.`}
      className={`shrink-0 flex items-center justify-center leading-none transition-colors ${size} ${statusClass} ${className}`}
    >
      {icon}
    </button>
  )
}
