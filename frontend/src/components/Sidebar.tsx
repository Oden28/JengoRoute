/**
 * components/Sidebar.tsx - Main navigation sidebar.
 *
 * Provides navigation to all dashboard pages:
 * - Dashboard (live feed + map)
 * - Incidents
 * - Guards
 * - Activity feed
 *
 * Uses Next.js Link for client-side navigation.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navigation items with labels and paths
const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Incidents', href: '/incidents', icon: '🚨' },
  { label: 'Guards', href: '/guards', icon: '👮' },
  { label: 'Activity', href: '/activity', icon: '📋' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      {/* Logo / Brand */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">🛡️ JengoRoute</h1>
        <p className="text-xs text-gray-400 mt-1">Security Operations</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">JengoRoute v0.1.0</p>
        <p className="text-xs text-gray-500">WhatsApp-native SecOps</p>
      </div>
    </aside>
  );
}

