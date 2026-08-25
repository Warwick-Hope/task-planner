'use client'

import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

/**
 * Drag activation shared by the calendar and the horizon planner.
 *
 * Both used a single PointerSensor with an 8px distance threshold. On a touch
 * screen that claims the gesture as soon as the finger moves, so any swipe that
 * began on a task chip dragged the chip instead of scrolling the list — and the
 * planner sidebar is nothing but chips. Mouse keeps the 8px threshold; touch
 * waits for a 220ms press first, which is the usual press-and-hold-to-drag
 * gesture and leaves ordinary swipes scrolling.
 */
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } })
  )
}
