import Link from 'next/link';
import AppShell from '@/components/layout/app-shell';

const NAV = [
  { href: '/wiki/items', label: 'Items' },
  { href: '/wiki/skills', label: 'Skills' },
  { href: '/wiki/mods', label: 'Mods' },
];

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <nav className="mb-6 flex gap-4" aria-label="Wiki sections">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="font-heading text-primary hover:underline">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        Item, skill, and mod data extracted from Path of Exile 2&apos;s own game files via the{' '}
        <a href="https://github.com/rajtik76/poe2-toolkit" className="underline">poe2-toolkit</a>{' '}
        library (MIT). Path of Exile 2 is a trademark of Grinding Gear Games. This project is
        not affiliated with or endorsed by Grinding Gear Games.
      </footer>
    </AppShell>
  );
}
