---
description: Frontend rules for GuardOps Next.js dashboard — pages, components, map, data fetching, and UI patterns
globs: frontend/**/*.{ts,tsx,js,jsx,css}
alwaysApply: false
---

# GuardOps Frontend Rules

## 1. Tech Stack

- **Next.js 14+** with App Router (no Pages Router)
- **TypeScript** in strict mode — no `any`, no implicit types
- **Tailwind CSS** for all styling — no inline styles, no CSS modules unless unavoidable
- **Leaflet / react-leaflet** for maps (default); Mapbox GL JS only if `NEXT_PUBLIC_MAP_PROVIDER=mapbox`
- **fetch()** for data fetching; SWR is acceptable as an enhancement but not required
- No Redux, Zustand, or other global state libraries for MVP
- No heavy UI component libraries — build focused operational components with Tailwind

---

## 2. Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with nav sidebar
│   │   ├── page.tsx            # Redirect to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── incidents/
│   │   │   └── page.tsx
│   │   ├── guards/
│   │   │   └── page.tsx
│   │   └── activity/
│   │       └── page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── dashboard/
│   │   │   ├── SummaryCards.tsx
│   │   │   ├── RecentEvents.tsx
│   │   │   └── IncidentAlerts.tsx
│   │   ├── map/
│   │   │   ├── EventMap.tsx    # Dynamically imported, ssr: false
│   │   │   └── EventMarker.tsx
│   │   ├── guards/
│   │   │   └── GuardCard.tsx
│   │   ├── incidents/
│   │   │   └── IncidentRow.tsx
│   │   └── shared/
│   │       ├── StatusBadge.tsx
│   │       ├── SeverityBadge.tsx
│   │       └── TimeAgo.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── types.ts
│   └── styles/
│       └── globals.css
├── public/
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

Do not add folders or files outside this structure without a clear reason. Keep components co-located with their feature domain.

---

## 3. TypeScript Interfaces (lib/types.ts)

Define all shared types in `lib/types.ts`. Do not duplicate types across files — always import from here.

```typescript
export interface DashboardSummary {
  total_guards_active: number;
  verified_checkins_today: number;
  unverified_events_today: number;
  open_incidents_count: number;
}

export type EventStatus = 'verified' | 'unverified' | 'pending_review';
export type EventType = 'check_in' | 'patrol' | 'incident' | 'note';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Event {
  id: string;
  event_type: EventType;
  status: EventStatus;
  description: string;
  user_name: string;
  site_name: string;
  latitude: number;
  longitude: number;
  occurred_at: string; // ISO 8601
}

export interface Incident {
  id: string;
  event_id: string;
  severity: Severity;
  category: string;
  description: string;
  guard_name: string;
  site_name: string;
  latitude: number;
  longitude: number;
  media_url: string | null;
  requires_escalation: boolean;
  created_at: string; // ISO 8601
}

export interface GuardStatus {
  id: string;
  full_name: string;
  assigned_site: string;
  assigned_post: string;
  last_event_type: EventType | null;
  last_event_time: string | null; // ISO 8601
  last_latitude: number | null;
  last_longitude: number | null;
  status: 'on_site_verified' | 'unverified' | 'no_activity';
  events_today_count: number;
}

export interface MapEvent {
  id: string;
  event_type: EventType;
  latitude: number;
  longitude: number;
  status: EventStatus;
  user_name: string;
  occurred_at: string; // ISO 8601
}

export interface EventFilters {
  limit?: number;
  site?: string;
  status?: EventStatus;
}

export interface IncidentFilters {
  severity?: Severity;
  site?: string;
  unresolved?: boolean;
}
```

---

## 4. API Client (lib/api.ts)

All backend calls go through `lib/api.ts`. Never call `fetch()` directly in components or pages.

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch('/api/dashboard/summary');
}

export async function fetchEvents(params?: EventFilters): Promise<Event[]> {
  return apiFetch('/api/events', params as Record<string, string | number | boolean>);
}

export async function fetchIncidents(params?: IncidentFilters): Promise<Incident[]> {
  return apiFetch('/api/incidents', params as Record<string, string | number | boolean>);
}

export async function fetchGuards(): Promise<GuardStatus[]> {
  return apiFetch('/api/guards');
}

export async function fetchMapEvents(): Promise<MapEvent[]> {
  return apiFetch('/api/map/events');
}
```

---

## 5. Page Specifications

### /dashboard (app/dashboard/page.tsx)
- Poll every 30 seconds using `setInterval` + `useState` + `useEffect`
- Render: `<SummaryCards>`, `<IncidentAlerts>` (high/critical, unresolved), `<RecentEvents>`, `<EventMap>`
- Data: `fetchDashboardSummary()`, `fetchEvents({ limit: 15 })`, `fetchIncidents({ unresolved: true })`, `fetchMapEvents()`
- Show a loading skeleton on initial load; show stale data while refreshing (no full spinner on poll)

### /incidents (app/incidents/page.tsx)
- Table with columns: Severity, Description, Guard, Site, Time, Status, Media
- Filter controls: severity dropdown, site dropdown (above the table)
- Default sort: most recent first
- Clicking a row expands an inline detail panel (no separate page needed for MVP)
- Data: `fetchIncidents(filters)`

### /guards (app/guards/page.tsx)
- Grid or table of `<GuardCard>` components
- Each card: guard name, assigned site/post, last event type + time, current status indicator, today's event count
- Status colours: green = on_site_verified, amber = unverified, gray = no_activity
- Data: `fetchGuards()` — refresh every 60 seconds

### /activity (app/activity/page.tsx)
- Vertical timeline feed, newest first
- Each entry: event type icon, guard name, site/post, `<TimeAgo>` + absolute time on hover, `<StatusBadge>`
- Load 50 events; add a "Load more" button (increment limit by 50)
- Data: `fetchEvents({ limit: 50 })`

---

## 6. Map Component (components/map/EventMap.tsx)

- Always wrap in `dynamic(() => import(...), { ssr: false })` at the import site — Leaflet requires `window`
- Default centre: Cape Town `[-33.92, 18.42]`, zoom 12
- Tile layer: OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- Marker colour logic (use a custom icon or DivIcon):
  - `check_in` + `verified` → green (`#16a34a`)
  - `check_in` + `unverified` → orange (`#ea580c`)
  - `patrol` → blue (`#2563eb`)
  - `incident` → red (`#dc2626`)
- Popup content per marker: user name, event type, formatted time, status badge, site name
- Accept `events: MapEvent[]` as prop — keep map stateless

```tsx
// Usage in dashboard/page.tsx
const EventMap = dynamic(() => import('@/components/map/EventMap'), { ssr: false });
```

---

## 7. Shared Components

### StatusBadge (components/shared/StatusBadge.tsx)
```tsx
const config: Record<EventStatus, { label: string; classes: string; icon: string }> = {
  verified:       { label: 'Verified',       classes: 'bg-green-100 text-green-800',  icon: '✓' },
  unverified:     { label: 'Unverified',     classes: 'bg-amber-100 text-amber-800',  icon: '⚠' },
  pending_review: { label: 'Pending Review', classes: 'bg-gray-100 text-gray-700',    icon: '⏱' },
};
```
Render as `<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ...">`.

### SeverityBadge (components/shared/SeverityBadge.tsx)
```tsx
const config: Record<Severity, { label: string; classes: string }> = {
  low:      { label: 'Low',      classes: 'bg-gray-100 text-gray-600' },
  medium:   { label: 'Medium',   classes: 'bg-yellow-100 text-yellow-800' },
  high:     { label: 'High',     classes: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Critical', classes: 'bg-red-100 text-red-800 font-bold' },
};
```

### TimeAgo (components/shared/TimeAgo.tsx)
- Compute relative time from ISO string (e.g. "5 min ago", "2 hrs ago")
- Render with `title={absoluteTime}` so the full timestamp shows on hover
- No external date library needed — implement with plain `Date` arithmetic for MVP

---

## 8. Layout (components/layout/)

### Sidebar.tsx
- Fixed left sidebar, width `w-56`
- Background: `bg-[#1a1a2e]`, text: `text-gray-300`
- Nav links: Dashboard (`/dashboard`), Incidents (`/incidents`), Guards (`/guards`), Activity (`/activity`)
- Active link: `bg-white/10 text-white font-semibold`
- App title/logo at top of sidebar
- Use Next.js `<Link>` and `usePathname()` for active detection

### Header.tsx
- Slim top bar inside the content area
- Shows current page title (passed as prop)
- Optional: last-refreshed timestamp on the dashboard page

### Root Layout (app/layout.tsx)
```tsx
<html lang="en">
  <body className="flex h-screen bg-gray-50 text-gray-900">
    <Sidebar />
    <div className="flex flex-col flex-1 overflow-hidden">
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  </body>
</html>
```

---

## 9. UI & Styling Rules

- **Tailwind only** — no custom CSS except in `globals.css` for base resets
- Spacing unit: multiples of 4 (`p-4`, `gap-4`, `mt-6`, etc.)
- Tables: `divide-y divide-gray-200`, row hover `hover:bg-gray-50`, header `bg-gray-100 text-xs font-semibold uppercase tracking-wide`
- Cards: `bg-white rounded-lg shadow-sm border border-gray-200 p-4`
- Summary stat cards: large number (`text-3xl font-bold`), label below (`text-sm text-gray-500`)
- No animations or transitions — operational dashboards prioritise information, not motion
- All badge/status elements must be immediately scannable — no ambiguous neutral colours for active states
- Do not use `text-gray-400` or lower for body text — minimum `text-gray-600` for readability
- Desktop-first layout; responsive breakpoints are acceptable but not required for MVP

---

## 10. Environment Variables

Declare in `.env.local` (never commit real values):

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MAP_PROVIDER=leaflet
NEXT_PUBLIC_MAPBOX_TOKEN=          # only required when MAP_PROVIDER=mapbox
```

Access only via `process.env.NEXT_PUBLIC_*` — never access server-only env vars in client components.

---

## 11. General Coding Conventions

- All components are **function components** with explicit return type annotation (`React.FC` or `: JSX.Element`)
- Export components as **named exports**, not default exports (except Next.js pages/layouts which must be default)
- Props interfaces are defined inline above the component and named `[ComponentName]Props`
- Async page components (`async function Page()`) are preferred for server-side data when polling is not needed
- Use `'use client'` directive only when the component uses browser APIs, event handlers, or hooks
- Do not `console.log` in production code — use a guarded `if (process.env.NODE_ENV === 'development')` block
- All time values from the API are ISO 8601 strings — parse with `new Date(isoString)` and format locally
- Error states must be visible — never silently swallow fetch errors; render an inline error message with a retry button
