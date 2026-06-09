import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShoppingList from '@/components/household/ShoppingList'
import type { ShoppingListItem } from '@/types'

export const metadata = { title: 'Shopping — Clarity' }

export default async function ShoppingPage({ params }: { params: { id: string } }) {
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

  const { data: items } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('workspace_id', params.id)
    .order('is_purchased')
    .order('created_at')

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

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Shopping list</h1>
        <p className="text-sm text-gray-500 mb-6">Items grouped by shop. Tick off as you go.</p>

        <ShoppingList
          workspaceId={params.id}
          initialItems={(items ?? []) as ShoppingListItem[]}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
