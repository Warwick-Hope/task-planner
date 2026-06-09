import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RoleCategoryManager from '@/components/roles/RoleCategoryManager'

export const metadata = { title: 'Household categories — Clarity' }

export default async function HouseholdCategoriesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    .select('name')
    .eq('id', params.id)
    .single()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', params.id)
    .is('owner_id', null)
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/household/${params.id}`}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← {workspace?.name ?? 'Household'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Household categories</h1>
        <p className="text-sm text-gray-500 mt-1">
          Shared categories visible to all household members. Tasks tagged with these categories
          appear in everyone&apos;s view.
        </p>
      </div>

      <div className="max-w-lg">
        <RoleCategoryManager
          initialCategories={categories ?? []}
          apiBase={`/api/household/${params.id}/categories`}
        />
      </div>
    </div>
  )
}
