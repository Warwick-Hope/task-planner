'use client'

import { useState } from 'react'
import type { Meal, MealPlan } from '@/types'

interface PlanWithMeal extends MealPlan {
  meal: Meal
}

interface Props {
  workspaceId: string
  initialMeals: Meal[]
  initialPlans: PlanWithMeal[]
  weekStart: string
  canManage: boolean
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDayLabel(dateStr: string, today: string): string {
  const d = new Date(dateStr)
  const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return dateStr === today ? `${label} · Today` : label
}

export default function MealPlanner({ workspaceId, initialMeals, initialPlans, weekStart, canManage }: Props) {
  const [meals, setMeals] = useState<Meal[]>(initialMeals)
  const [plans, setPlans] = useState<PlanWithMeal[]>(initialPlans)
  const [week, setWeek] = useState(weekStart)
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const [mealSearch, setMealSearch] = useState('')
  const [newMealName, setNewMealName] = useState('')
  const [addingMeal, setAddingMeal] = useState(false)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))

  // Fetch plans for the current week when week changes
  async function loadWeekPlans(ws: string) {
    const from = ws
    const to = addDays(ws, 6)
    const res = await fetch(`/api/household/${workspaceId}/meal-plan?from=${from}&to=${to}`)
    const json = await res.json()
    if (res.ok) {
      setPlans((prev) => {
        const outsideWeek = prev.filter((p) => p.planned_date < ws || p.planned_date > to)
        return [...outsideWeek, ...(json.plans ?? [])]
      })
    }
  }

  function handlePrevWeek() {
    const next = addDays(week, -7)
    setWeek(next)
    loadWeekPlans(next)
  }

  function handleNextWeek() {
    const next = addDays(week, 7)
    setWeek(next)
    loadWeekPlans(next)
  }

  function handleThisWeek() {
    setWeek(weekStart)
    loadWeekPlans(weekStart)
  }

  const plansForDate = (date: string) => plans.filter((p) => p.planned_date === date)

  async function assignMeal(meal: Meal, date: string) {
    setLoading(true)
    const res = await fetch(`/api/household/${workspaceId}/meal-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_id: meal.id, planned_date: date }),
    })
    const json = await res.json()
    setLoading(false)
    if (res.ok) {
      setPlans((prev) => [...prev, json.plan])
    }
    setPickingFor(null)
    setMealSearch('')
  }

  async function removePlan(planId: string) {
    setPlans((prev) => prev.filter((p) => p.id !== planId))
    await fetch(`/api/household/${workspaceId}/meal-plan/${planId}`, { method: 'DELETE' })
  }

  async function createAndAssign(date: string) {
    if (!newMealName.trim()) return
    setAddingMeal(true)
    const res = await fetch(`/api/household/${workspaceId}/meals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMealName.trim() }),
    })
    const json = await res.json()
    setAddingMeal(false)
    if (!res.ok) return
    const meal: Meal = json.meal
    setMeals((prev) => [...prev, meal].sort((a, b) => a.name.localeCompare(b.name)))
    setNewMealName('')
    await assignMeal(meal, date)
  }

  const filteredMeals = meals.filter((m) =>
    m.name.toLowerCase().includes(mealSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <button onClick={handlePrevWeek} className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm transition-colors">←</button>
        <button onClick={handleNextWeek} className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm transition-colors">→</button>
        {week !== weekStart && (
          <button onClick={handleThisWeek} className="text-xs text-blue-600 hover:text-blue-800 transition-colors">This week</button>
        )}
        <span className="text-sm text-gray-500 ml-auto">
          {new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {' – '}
          {new Date(addDays(week, 6)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Day grid */}
      <div className="space-y-2">
        {days.map((date, i) => {
          const dayPlans = plansForDate(date)
          const isToday = date === today
          const isPicking = pickingFor === date

          return (
            <div
              key={date}
              className={`rounded-lg border bg-white overflow-hidden ${isToday ? 'border-blue-200' : 'border-gray-200'}`}
            >
              {/* Day header */}
              <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                <div>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                    {DAY_NAMES[i]}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">{formatDayLabel(date, today)}</span>
                </div>
                {canManage && !isPicking && (
                  <button
                    onClick={() => { setPickingFor(date); setMealSearch('') }}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    + Add meal
                  </button>
                )}
              </div>

              {/* Planned meals */}
              {dayPlans.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {dayPlans.map((plan) => (
                    <div key={plan.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <span className="text-base">🍽️</span>
                      <span className="flex-1 text-sm text-gray-900">{plan.meal.name}</span>
                      {canManage && (
                        <button
                          onClick={() => removePlan(plan.id)}
                          aria-label="Remove meal"
                          className="inline-flex items-center justify-center min-h-[36px] min-w-[32px] sm:min-h-0 sm:min-w-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity text-xs text-gray-300 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {dayPlans.length === 0 && !isPicking && (
                <div className="px-4 py-2.5">
                  <span className="text-xs text-gray-300">Nothing planned</span>
                </div>
              )}

              {/* Meal picker */}
              {isPicking && (
                <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                  <input
                    type="text"
                    value={mealSearch}
                    onChange={(e) => setMealSearch(e.target.value)}
                    placeholder="Search meals…"
                    autoFocus
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  {filteredMeals.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-200">
                      {filteredMeals.map((meal) => (
                        <li key={meal.id}>
                          <button
                            onClick={() => assignMeal(meal, date)}
                            disabled={loading}
                            className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 transition-colors"
                          >
                            {meal.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {filteredMeals.length === 0 && mealSearch && (
                    <p className="text-xs text-gray-400">No matches — create it below.</p>
                  )}

                  {/* Quick-create */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newMealName || mealSearch}
                      onChange={(e) => setNewMealName(e.target.value || mealSearch)}
                      onFocus={() => { if (!newMealName) setNewMealName(mealSearch) }}
                      placeholder="New meal name…"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => createAndAssign(date)}
                      disabled={addingMeal || !(newMealName || mealSearch).trim()}
                      className="rounded-md bg-blue-600 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {addingMeal ? '…' : 'Create & add'}
                    </button>
                  </div>

                  <button
                    onClick={() => { setPickingFor(null); setMealSearch(''); setNewMealName('') }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
