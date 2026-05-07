import { createClient } from '@/lib/supabase-server'
import BrainDumpClient from '@/components/brain-dump/BrainDumpClient'

export const metadata = { title: 'Brain dump — Clarity' }

export default async function BrainDumpPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('owner_id', user!.id)
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Brain dump</h1>
        <p className="mt-1 text-sm text-gray-500">
          Write whatever&apos;s on your mind — Claude will pull it apart into tasks you can review before saving.
        </p>
      </div>
      <BrainDumpClient categories={categories ?? []} />
    </div>
  )
}
