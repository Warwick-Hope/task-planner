import AppShell from '@/components/layout/AppShell'
import HouseholdNav from '@/components/nav/HouseholdNav'

export default function HouseholdLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell variant="household" nav={<HouseholdNav />}>
      {children}
    </AppShell>
  )
}
