'use client'

import { useState } from 'react'
import type { Meal, Ingredient } from '@/types'

interface MealWithIngredients extends Meal {
  ingredients: Ingredient[]
}

interface Props {
  workspaceId: string
  initialMeals: MealWithIngredients[]
  canManage: boolean
}

export default function MealLibrary({ workspaceId, initialMeals, canManage }: Props) {
  const [meals, setMeals] = useState<MealWithIngredients[]>(initialMeals)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [editMealName, setEditMealName] = useState('')
  const [showAddMeal, setShowAddMeal] = useState(false)
  const [newMealName, setNewMealName] = useState('')
  const [addingIngredientTo, setAddingIngredientTo] = useState<string | null>(null)
  const [ingredientForm, setIngredientForm] = useState({ name: '', quantity: '', unit: '' })
  const [pushingMealId, setPushingMealId] = useState<string | null>(null)
  const [needSet, setNeedSet] = useState<Set<string>>(new Set())
  const [pushing, setPushing] = useState(false)
  const [pushDone, setPushDone] = useState<string | null>(null)

  async function addMeal(e: React.FormEvent) {
    e.preventDefault()
    if (!newMealName.trim()) return
    const res = await fetch(`/api/household/${workspaceId}/meals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMealName.trim() }),
    })
    const json = await res.json()
    if (res.ok) {
      setMeals((prev) => [...prev, { ...json.meal, ingredients: [] }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewMealName('')
      setShowAddMeal(false)
    }
  }

  async function saveMealName(mealId: string) {
    if (!editMealName.trim()) return
    const res = await fetch(`/api/household/${workspaceId}/meals/${mealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editMealName.trim() }),
    })
    const json = await res.json()
    if (res.ok) {
      setMeals((prev) => prev.map((m) => m.id === mealId ? { ...m, name: json.meal.name } : m))
    }
    setEditingMealId(null)
  }

  async function deleteMeal(mealId: string) {
    if (!confirm('Delete this meal and all its ingredients?')) return
    const res = await fetch(`/api/household/${workspaceId}/meals/${mealId}`, { method: 'DELETE' })
    if (res.ok) setMeals((prev) => prev.filter((m) => m.id !== mealId))
  }

  async function addIngredient(mealId: string, e: React.FormEvent) {
    e.preventDefault()
    if (!ingredientForm.name.trim()) return
    const res = await fetch(`/api/household/${workspaceId}/meals/${mealId}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingredientForm),
    })
    const json = await res.json()
    if (res.ok) {
      setMeals((prev) => prev.map((m) =>
        m.id === mealId ? { ...m, ingredients: [...m.ingredients, json.ingredient] } : m
      ))
      setIngredientForm({ name: '', quantity: '', unit: '' })
      setAddingIngredientTo(null)
    }
  }

  async function deleteIngredient(mealId: string, ingredientId: string) {
    const res = await fetch(`/api/household/${workspaceId}/meals/${mealId}/ingredients/${ingredientId}`, { method: 'DELETE' })
    if (res.ok) {
      setMeals((prev) => prev.map((m) =>
        m.id === mealId ? { ...m, ingredients: m.ingredients.filter((i) => i.id !== ingredientId) } : m
      ))
    }
  }

  function openPush(meal: MealWithIngredients) {
    setPushingMealId(meal.id)
    setNeedSet(new Set(meal.ingredients.map((i) => i.id)))
    setPushDone(null)
  }

  function toggleNeed(ingredientId: string) {
    setNeedSet((prev) => {
      const next = new Set(prev)
      if (next.has(ingredientId)) next.delete(ingredientId)
      else next.add(ingredientId)
      return next
    })
  }

  async function pushToShoppingList(meal: MealWithIngredients) {
    const needed = meal.ingredients.filter((i) => needSet.has(i.id))
    if (needed.length === 0) { setPushingMealId(null); return }
    setPushing(true)

    await Promise.all(
      needed.map((ing) =>
        fetch(`/api/household/${workspaceId}/shopping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            source: 'meal',
            source_id: meal.id,
          }),
        })
      )
    )

    // Auto-create "Go shopping" task if not already present
    await fetch(`/api/household/${workspaceId}/shopping/task`, { method: 'POST' })

    setPushing(false)
    setPushDone(`Added ${needed.length} item${needed.length !== 1 ? 's' : ''} to shopping list.`)
    setTimeout(() => { setPushingMealId(null); setPushDone(null) }, 2000)
  }

  return (
    <div className="space-y-3">
      {meals.map((meal) => (
        <section key={meal.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Meal header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <button
              onClick={() => setExpandedId(expandedId === meal.id ? null : meal.id)}
              className="flex-1 text-left flex items-center gap-2"
            >
              <span className="text-sm font-medium text-gray-900">{meal.name}</span>
              <span className="text-xs text-gray-400">
                {meal.ingredients.length > 0 ? `${meal.ingredients.length} ingredient${meal.ingredients.length !== 1 ? 's' : ''}` : 'No ingredients'}
              </span>
              <span className="text-gray-400 text-xs ml-auto">{expandedId === meal.id ? '▲' : '▼'}</span>
            </button>
            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setEditingMealId(meal.id); setEditMealName(meal.name) }}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Rename
                </button>
                {meal.ingredients.length > 0 && (
                  <button
                    onClick={() => openPush(meal)}
                    className="text-xs text-green-600 hover:text-green-800 transition-colors"
                  >
                    → Shopping
                  </button>
                )}
                <button
                  onClick={() => deleteMeal(meal.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Rename form */}
          {editingMealId === meal.id && (
            <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
              <input
                type="text"
                value={editMealName}
                onChange={(e) => setEditMealName(e.target.value)}
                autoFocus
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => saveMealName(meal.id)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 transition-colors"
              >Save</button>
              <button
                onClick={() => setEditingMealId(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >Cancel</button>
            </div>
          )}

          {/* Push to shopping panel */}
          {pushingMealId === meal.id && (
            <div className="px-4 py-3 border-b border-gray-200 bg-green-50 space-y-3">
              <p className="text-xs font-medium text-green-800">Select ingredients to add to shopping list:</p>
              {pushDone ? (
                <p className="text-sm text-green-700 font-medium">{pushDone}</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {meal.ingredients.map((ing) => (
                      <li key={ing.id}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={needSet.has(ing.id)}
                            onChange={() => toggleNeed(ing.id)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-800">
                            {ing.name}
                            {(ing.quantity || ing.unit) && (
                              <span className="ml-1 text-gray-400 text-xs">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button
                      onClick={() => pushToShoppingList(meal)}
                      disabled={pushing || needSet.size === 0}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {pushing ? 'Adding…' : `Add ${needSet.size} to list`}
                    </button>
                    <button
                      onClick={() => setPushingMealId(null)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Ingredients list */}
          {expandedId === meal.id && (
            <div>
              {meal.ingredients.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {meal.ingredients.map((ing) => (
                    <li key={ing.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <span className="flex-1 text-sm text-gray-800">
                        {ing.name}
                        {(ing.quantity || ing.unit) && (
                          <span className="ml-2 text-xs text-gray-400">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</span>
                        )}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => deleteIngredient(meal.id, ing.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-500 transition-opacity"
                        >✕</button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-2.5 text-xs text-gray-400">No ingredients yet.</p>
              )}

              {/* Add ingredient form */}
              {canManage && addingIngredientTo === meal.id ? (
                <form onSubmit={(e) => addIngredient(meal.id, e)} className="px-4 py-3 border-t border-gray-100 flex gap-2">
                  <input
                    type="text"
                    value={ingredientForm.name}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ingredient"
                    required
                    autoFocus
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={ingredientForm.quantity}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="Qty"
                    className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={ingredientForm.unit}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="Unit"
                    className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 transition-colors">Add</button>
                  <button type="button" onClick={() => setAddingIngredientTo(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">✕</button>
                </form>
              ) : (
                canManage && (
                  <div className="px-4 py-2.5 border-t border-gray-100">
                    <button
                      onClick={() => { setAddingIngredientTo(meal.id); setIngredientForm({ name: '', quantity: '', unit: '' }) }}
                      className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >+ Add ingredient</button>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      ))}

      {meals.length === 0 && !showAddMeal && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center">
          <p className="text-sm text-gray-400">No meals yet. Add your first meal to get started.</p>
        </div>
      )}

      {/* Add meal */}
      {canManage && showAddMeal ? (
        <form onSubmit={addMeal} className="flex gap-2">
          <input
            type="text"
            value={newMealName}
            onChange={(e) => setNewMealName(e.target.value)}
            placeholder="Meal name"
            required
            autoFocus
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors">Add</button>
          <button type="button" onClick={() => { setShowAddMeal(false); setNewMealName('') }} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
        </form>
      ) : (
        canManage && (
          <button onClick={() => setShowAddMeal(true)} className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
            + Add meal
          </button>
        )
      )}
    </div>
  )
}
