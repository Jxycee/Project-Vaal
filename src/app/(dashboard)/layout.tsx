// Protected routes share the full app shell (sidebar + bottom nav). Proxy
// already gates this group, so only signed-in users reach here.
import AppShell from '@/components/layout/app-shell'

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
