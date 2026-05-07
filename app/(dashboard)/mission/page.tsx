import { createClient } from '@/lib/supabase-server'
import MissionEditor from '@/components/mission/MissionEditor'
import ValuesList from '@/components/mission/ValuesList'
import type { Mission, Value } from '@/types'

export const metadata = { title: 'Mission & Values — Clarity' }

export default async function MissionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: missionData }, { data: valuesData }] = await Promise.all([
    supabase
      .from('missions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('values')
      .select('*')
      .eq('user_id', user!.id)
      .order('sort_order', { ascending: true }),
  ])

  const mission = missionData as Mission | null
  const values  = (valuesData ?? []) as Value[]

  return (
    <div className="max-w-2xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mission &amp; Values</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your personal north star. Refer back to this when setting priorities.
        </p>
      </div>

      {/* Mission statement */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Mission statement</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            One or two sentences that capture what you&apos;re here to do.
          </p>
        </div>
        <MissionEditor initial={mission} />
      </section>

      {/* Divider */}
      <hr className="border-gray-100" />

      {/* Values */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Values</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            The principles that guide your decisions. Keep it to the ones that truly matter.
          </p>
        </div>
        <ValuesList initial={values} />
      </section>
    </div>
  )
}
