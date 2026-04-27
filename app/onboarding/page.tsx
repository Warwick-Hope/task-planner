import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'

export const metadata = { title: 'Get started — Clarity' }

export default async function OnboardingPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // If profile already exists, onboarding is done
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (profile) {
    redirect('/dashboard')
  }

  return <OnboardingWizard />
}
