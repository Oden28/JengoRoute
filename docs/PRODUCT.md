# Product Specification

## Product Name
JengoRoute MVP

## Problem

Most security companies in South Africa already coordinate guards through WhatsApp. This creates several operational problems:

- guard activity is not structured
- supervisors cannot reliably verify presence
- incident data is buried in chats
- reporting is manual and fragmented
- teams rely on trust rather than verifiable events
- there is little real-time visibility across sites

## Product Thesis

Instead of replacing WhatsApp, use it as the guard interface and turn it into a structured security operations layer.

Guards should be able to:
- check in
- report patrol completion
- report incidents
- send location
- send photos

Supervisors should be able to:
- see a live operational feed
- verify whether guards are where they should be
- see incidents on a map
- identify missing or unverified check-ins
- review patrol activity
- receive alerts quickly

## Why WhatsApp-First Matters

In South Africa, WhatsApp is already the default coordination layer for many field operations teams. This means:

- low training cost
- no app installation friction
- high engagement
- familiar user experience
- faster adoption in SMEs and mid-sized companies

## Primary Users

### Guards
Field staff who communicate entirely through WhatsApp.

### Supervisors
Operations staff who need live visibility, alerts, and event review.

### Company Admins
Users who configure sites, guard assignments, and company settings.

## Core MVP Jobs to Be Done

### For Guards
- “I need to report that I arrived on site.”
- “I need to report a patrol completion quickly.”
- “I need to report an incident with proof.”

### For Supervisors
- “I need to know whether guards checked in correctly.”
- “I need to see incidents as they happen.”
- “I need an operational view across guards and sites.”

## MVP Features

1. WhatsApp message ingestion
2. Raw message storage
3. Check-in detection
4. Patrol event detection
5. Incident event detection
6. Verification by time and location
7. Optional photo proof capture
8. Dashboard live activity feed
9. Incidents page
10. Guards page
11. Map visualization
12. Supervisor alerts for incidents and unverified check-ins

## Non-Goals for MVP

- advanced AI conversational agent
- shift scheduling engine
- invoice generation
- payroll integration
- facial recognition
- offline mobile app
- full ERP integration

## Success Criteria

The MVP is successful if:
- a guard can send a check-in through WhatsApp and it becomes a structured event
- a guard can send an incident with media and location
- the system can verify or flag events
- a supervisor can see all of this in a dashboard
- alerts are triggered for important operational exceptions