/**
 * components/layout/Sidebar.tsx — Responsive navigation.
 *
 * Desktop (md+):  Persistent left-rail sidebar.
 * Mobile  (<md):  Fixed top bar with hamburger → slide-out drawer overlay.
 *
 * The drawer auto-closes on route change so tapping a link
 * immediately shows the new page without a stale overlay.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ── Nav Items ─────────────────────────────────────────────────────────────── */

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: 'Incidents',
    href: '/incidents',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    label: 'Guards',
    href: '/guards',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    label: 'Activity',
    href: '/activity',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  },
];

/* ── Shared Brand ──────────────────────────────────────────────────────────── */

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-sm font-bold text-white">
        J
      </div>
      <div>
        <h1 className="text-sm font-bold tracking-tight">JengoRoute</h1>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
          Security Ops
        </p>
      </div>
    </div>
  );
}

/* ── Shared Nav Link ───────────────────────────────────────────────────────── */

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: (typeof navItems)[number];
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
        transition-all duration-150
        ${
          isActive
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }
      `}
    >
      <span className={isActive ? 'text-emerald-400' : ''}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

/* ── Status Footer ─────────────────────────────────────────────────────────── */

function StatusFooter() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[11px] text-slate-500">System operational</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 *  Main Export
 * ══════════════════════════════════════════════════════════════════════════════ */

export default function Sidebar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
       *  MOBILE: Fixed top bar (visible < md)
       * ════════════════════════════════════════════════════════════════════ */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <Brand />
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-slate-400 hover:text-white p-1.5 -mr-1.5 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
       *  MOBILE: Slide-out drawer overlay (visible < md when open)
       * ════════════════════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-64 bg-slate-900 text-white flex flex-col h-full shadow-2xl animate-slide-in">
            {/* Header with close */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(item.href + '/');
                return (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    onClick={() => setDrawerOpen(false)}
                  />
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-800">
              <StatusFooter />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
       *  DESKTOP: Persistent left-rail sidebar (visible md+)
       * ════════════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex w-60 bg-slate-900 text-white flex-col min-h-screen border-r border-slate-800">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800">
          <Brand />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <NavLink key={item.href} item={item} isActive={isActive} />
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800">
          <StatusFooter />
        </div>
      </aside>
    </>
  );
}
