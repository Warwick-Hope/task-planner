import { createClient } from '@/lib/supabase-server'
import RoleCategoryManager from '@/components/roles/RoleCategoryManager'

export const metadata = { title: 'Roles — Task Planner' }

export default async function RolesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: categories } = await supabase
    .from('role_categories')
    .select('id, name, colour, parent_id, sort_order')
    .eq('user_id', user!.id)
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Roles</h1>
        <p className="mt-1 text-sm text-gray-500">
          Organise your tasks by role or domain. Top-level roles carry a colour; subcategories
          inherit it.
        </p>
      </div>
      <div className="max-w-lg">
        <RoleCategoryManager initialCategories={categories ?? []} />
      </div>
    </div>
  )
}
