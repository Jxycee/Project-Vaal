// Protected routes share the full app shell (sidebar + bottom nav). Proxy
// already gates this group, so only signed-in users reach here — including
// /builds (finder, own builds, shared build viewer), added to
// PROTECTED_PREFIXES in src/proxy.ts as of Task 4.
import AppShell from '@/components/layout/app-shell'

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
