'use client'

// Shared app chrome: desktop sidebar + mobile top bar + mobile bottom nav,
// with one centred content container. Live routes are links; unbuilt features
// render as dimmed "Soon" items so nothing 404s. Semantic tokens only.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: string; live: boolean }

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', live: true },
  { href: '/prices', label: 'Prices', icon: 'prices', live: true },
  { href: '/tree', label: 'Tree', icon: 'tree', live: true },
  { href: '/builds', label: 'Builds', icon: 'builds', live: false },
  { href: '/wiki', label: 'Wiki', icon: 'wiki', live: false },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

function Brand({ size = 'sm', href }: { size?: 'sm' | 'md'; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/vaal-emblem.png"
        alt=""
        className={size === 'md' ? 'size-12' : 'size-16'}
      />
      <span
        className={cn(
          'font-heading font-semibold tracking-wide text-foreground',
          size === 'md' ? 'text-lg' : 'text-base'
        )}
      >
        Project Vaal
      </span>
    </Link>
  )
}

export function ShellChrome({
  email,
  signOutAction,
  children,
}: {
  email: string | null
  signOutAction: () => Promise<void>
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const signedIn = !!email

  // When signed in, "Home" and the brand return you to the dashboard rather
  // than the public landing page.
  const homeHref = signedIn ? '/dashboard' : '/'
  const navItems = NAV.map((item) =>
    item.icon === 'home' ? { ...item, href: homeHref } : item
  )

  const AccountControl = signedIn ? (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" className="gap-2">
        <Icon name="sign-out" className="size-4" />
        Sign out
      </Button>
    </form>
  ) : (
    <Button asChild size="sm">
      <Link href="/login">Sign in</Link>
    </Button>
  )

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border md:bg-card/40 md:px-3 md:py-5">
        <div className="mb-4 px-2">
          <Brand size="md" href={homeHref} />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href)
            const base =
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
            if (!item.live) {
              return (
                <span
                  key={item.href}
                  className={cn(base, 'cursor-default text-muted-foreground/50')}
                >
                  <Icon name={item.icon} className="size-5" />
                  {item.label}
                  <span className="ml-auto text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Soon
                  </span>
                </span>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  base,
                  active
                    ? 'bg-accent text-primary'
                    : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Icon
                  name={item.icon}
                  className={cn('size-5', active ? 'text-primary' : 'text-current')}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto px-1">{AccountControl}</div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-[100dvh] flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:hidden">
          <Brand href={homeHref} />
          {AccountControl}
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t border-border bg-background/90 backdrop-blur md:hidden">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href)
          const inner = (color: string) => (
            <>
              <Icon name={item.icon} className={cn('size-6', color)} />
              <span className={cn('text-[0.65rem] font-medium', color)}>
                {item.label}
              </span>
            </>
          )
          if (!item.live) {
            return (
              <span
                key={item.href}
                className="flex flex-1 flex-col items-center justify-center gap-1"
              >
                {inner('text-muted-foreground/40')}
              </span>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-1"
            >
              {inner(active ? 'text-primary' : 'text-muted-foreground')}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
