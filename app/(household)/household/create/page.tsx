import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import CreateHouseholdForm from '@/components/household/CreateHouseholdForm'

export const metadata = { title: 'Create household — Clarity' }

export default async function CreateHouseholdPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Create a household</h1>
      <p className="text-sm text-gray-500 mb-8">
        A household workspace is shared with your family. You&apos;ll be the owner and can invite
        others once it&apos;s set up.
      </p>
      <CreateHouseholdForm />
    </div>
  )
}
