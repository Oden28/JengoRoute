# Frontend Specification

## Goal

Provide a simple supervisor dashboard for operational visibility. Do not prioritize visual polish over function.

## Pages

### `/dashboard`
Purpose:
- top-level operational overview

Should show:
- summary cards
- recent events
- incidents needing attention
- map with event markers
- verified vs unverified counts

### `/incidents`
Purpose:
- incident review screen

Should show:
- incident list
- severity
- timestamp
- location
- linked media if available
- associated guard
- verification status

### `/guards`
Purpose:
- current guard activity and latest status

Should show:
- guard name
- assigned site/post
- last event
- last known location
- current status indicator
- count of today’s events

### `/activity`
Purpose:
- chronological operational feed

Should show:
- latest events first
- event type
- user
- site/post
- timestamp
- verification badge

## Map Component

Should render:
- guard event markers
- incident markers
- optional patrol route markers
- status-based visual differentiation

Each marker popup should show:
- user name
- event type
- time
- status
- site or post if known

## Data Strategy

MVP acceptable options:
- polling every few seconds
- simple server-side fetch on page load
- optional realtime later

## UI Guidance

- clear badges for verified/unverified/pending
- incident severity should be easy to spot
- focus on readability and operational clarity