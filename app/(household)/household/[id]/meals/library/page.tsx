import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MealLibrary from '@/components/household/MealLibrary'
import type { Meal, Ingredient } from '@/types'

export const metadata = { title: 'Meal library — Clarity' }

interface MealWithIngredients extends Meal {
  ingredients: Ingredient[]
}

export default async function MealLibraryPage({ params }: { params: { id: string } }) {
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

  const { data: meals } = await supabase
    .from('meals')
    .select('*, ingredients(*)')
    .eq('workspace_id', params.id)
    .order('name')

  const canManage = membership.role !== 'restricted'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/household/${params.id}/meals`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Meal plan
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Meal library</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your saved meals and ingredients. Expand a meal to manage its ingredients, then push needed items to the shopping list.
        </p>

        <MealLibrary
          workspaceId={params.id}
          initialMeals={(meals ?? []) as MealWithIngredients[]}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
