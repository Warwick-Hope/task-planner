import AppShell from '@/components/layout/AppShell'
import PersonalNav from '@/components/nav/PersonalNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell variant="personal" nav={v => <PersonalNav variant={v} />}>
      {children}
    </AppShell>
  )
}
