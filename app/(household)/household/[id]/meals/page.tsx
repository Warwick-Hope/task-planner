import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MealPlanner from '@/components/household/MealPlanner'
import type { Meal, MealPlan } from '@/types'

export const metadata = { title: 'Meal plan — Clarity' }

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

interface PlanWithMeal extends MealPlan {
  meal: Meal
}

export default async function MealsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/dashboard')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, type')
    .eq('id', params.id)
    .single()

  if (!workspace || workspace.type !== 'household') redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]
  const weekStart = getMondayOfWeek(today)
  const weekEnd = addDays(weekStart, 6)

  const [{ data: meals }, { data: plans }] = await Promise.all([
    supabase.from('meals').select('*').eq('workspace_id', params.id).order('name'),
    supabase
      .from('meal_plan')
      .select('*, meal:meals(id, name, notes)')
      .eq('workspace_id', params.id)
      .gte('planned_date', weekStart)
      .lte('planned_date', weekEnd)
      .order('planned_date'),
  ])

  const canManage = membership.role !== 'restricted'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/household/${params.id}`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← {workspace.name}
          </Link>
        </div>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Meal plan</h1>
          <Link
            href={`/household/${params.id}/meals/library`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Meal library →
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">Plan meals for each day of the week.</p>

        <MealPlanner
          workspaceId={params.id}
          initialMeals={(meals ?? []) as Meal[]}
          initialPlans={(plans ?? []) as PlanWithMeal[]}
          weekStart={weekStart}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
