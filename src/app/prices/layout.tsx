// Prices is public, but still gets the shared shell so anonymous and signed-in
// users both have navigation and a way back to the dashboard.
import AppShell from '@/components/layout/app-shell'

export default function PricesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
