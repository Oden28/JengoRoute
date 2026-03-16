# Frontend SKILLS.md

This file defines the frontend architecture, UI/UX rules, and implementation standards for the WhatsApp-native security operations MVP.

The frontend must prioritize:

- clarity over visual polish
- operational usability over marketing aesthetics
- fast implementation
- predictable structure
- easy iteration
- real-time situational awareness for supervisors

This is an operations dashboard, not a consumer app.

---

## 1. Frontend purpose

The frontend exists for supervisors, operators, and internal staff to monitor and respond to field activity coming from guards using WhatsApp.

Guards do not use this frontend.

The frontend must help supervisors do the following well:

- see live operational activity
- detect incidents quickly
- identify unverified check-ins
- monitor guard status
- review historical activity
- view map-based field context
- inspect evidence such as photos, voice notes, and timestamps

The UI should feel functional, structured, and operational.

---

## 2. Core frontend principles

### 2.1 Build for function first
Focus on working architecture and usable workflows before visual refinement.

The UI does not need to be beautiful in the MVP.
It does need to be understandable and dependable.

### 2.2 Prioritize high-signal information
Important operational information must stand out immediately.

Examples:

- incidents
- missed or unverified check-ins
- location mismatches
- recent guard activity
- active alerts

Do not bury operationally important information under unnecessary layout complexity.

### 2.3 Keep flows shallow
Supervisors should reach critical information in as few clicks as possible.

The MVP should avoid:

- deep nested navigation
- hidden actions
- complicated filters at first
- excessive modal chains

### 2.4 State must be explicit
Every operational item should clearly communicate its current state.

Examples:

- verified
- unverified
- pending review
- incident open
- incident resolved
- guard active
- guard inactive
- location missing

Avoid ambiguous UI labels.

### 2.5 Design for imperfect data
The system will often receive partial WhatsApp input.

The UI must gracefully handle:

- missing location
- missing media
- missing guard assignment
- delayed event ingestion
- partially processed events
- duplicate or retried messages

Never assume data is always complete.

---

## 3. Frontend architecture

The frontend should be implemented using Next.js.

Preferred structure:

```txt
frontend/
├── app/
│   ├── dashboard/
│   ├── incidents/
│   ├── guards/
│   ├── activity/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── layout/
│   ├── dashboard/
│   ├── incidents/
│   ├── guards/
│   ├── activity/
│   ├── map/
│   ├── status/
│   ├── cards/
│   ├── tables/
│   └── ui/
├── lib/
│   ├── api/
│   ├── utils/
│   ├── types/
│   ├── formatters/
│   └── constants/
├── hooks/
├── services/
├── public/
└── styles/