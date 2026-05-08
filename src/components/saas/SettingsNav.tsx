'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const settingsLinks = [
  { href: '/app/settings/firm', label: 'Firm' },
  { href: '/app/settings/checklists', label: 'Checklists' },
  { href: '/app/settings/team', label: 'Team' },
  { href: '/app/settings/billing', label: 'Billing' },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {settingsLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            pathname === link.href
              ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
              : 'border-black/10 bg-white/70 text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
