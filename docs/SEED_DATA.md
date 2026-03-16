# SEED_DATA.md

## Purpose

This file defines the initial seed data for the WhatsApp-native security operations MVP.

The goal of the seed data is to:

- make local development easier
- allow the dashboard to display realistic data immediately
- support testing of check-ins, patrols, incidents, and verification
- create a predictable environment for backend and frontend development

This data is not production data. It is development and demo data only.

---

# Seed Data Principles

- Use one company for the initial MVP seed
- Use a small number of supervisors, guards, sites, and patrol routes
- Include both verified and unverified scenarios
- Include realistic South African-style site naming and phone formatting
- Ensure data relationships are valid and consistent
- Provide enough data for the dashboard, incidents page, guards page, and activity feed

---

# Seed Company

## Company
- id: `comp_safeguard_001`
- name: `Safeguard Security Services`
- slug: `safeguard-security-services`
- country: `South Africa`
- city: `Cape Town`
- created_at: `2026-03-16T08:00:00Z`

---

# Seed Users

## Supervisors

### Supervisor 1
- id: `user_sup_001`
- company_id: `comp_safeguard_001`
- role: `supervisor`
- full_name: `Michael Daniels`
- phone_e164: `+27710000001`
- email: `michael.daniels@safeguard.local`
- is_active: `true`

### Supervisor 2
- id: `user_sup_002`
- company_id: `comp_safeguard_001`
- role: `supervisor`
- full_name: `Nomsa Khumalo`
- phone_e164: `+27710000002`
- email: `nomsa.khumalo@safeguard.local`
- is_active: `true`

## Guards

### Guard 1
- id: `user_guard_001`
- company_id: `comp_safeguard_001`
- role: `guard`
- full_name: `Sipho Dlamini`
- phone_e164: `+27720000001`
- email: `sipho.dlamini@safeguard.local`
- is_active: `true`

### Guard 2
- id: `user_guard_002`
- company_id: `comp_safeguard_001`
- role: `guard`
- full_name: `Thabo Mokoena`
- phone_e164: `+27720000002`
- email: `thabo.mokoena@safeguard.local`
- is_active: `true`

### Guard 3
- id: `user_guard_003`
- company_id: `comp_safeguard_001`
- role: `guard`
- full_name: `Anele Jacobs`
- phone_e164: `+27720000003`
- email: `anele.jacobs@safeguard.local`
- is_active: `true`

### Guard 4
- id: `user_guard_004`
- company_id: `comp_safeguard_001`
- role: `guard`
- full_name: `Lutho Ndlovu`
- phone_e164: `+27720000004`
- email: `lutho.ndlovu@safeguard.local`
- is_active: `true`

---

# Seed Sites

## Site 1
- id: `site_001`
- company_id: `comp_safeguard_001`
- name: `Cavendish Retail Complex`
- code: `CRC-01`
- address_line_1: `1 Dreyer Street`
- suburb: `Claremont`
- city: `Cape Town`
- province: `Western Cape`
- country: `South Africa`
- latitude: `-33.9806`
- longitude: `18.4654`
- radius_meters: `150`
- is_active: `true`

## Site 2
- id: `site_002`
- company_id: `comp_safeguard_001`
- name: `Montague Industrial Park`
- code: `MIP-01`
- address_line_1: `12 Bolt Avenue`
- suburb: `Montague Gardens`
- city: `Cape Town`
- province: `Western Cape`
- country: `South Africa`
- latitude: `-33.8647`
- longitude: `18.5361`
- radius_meters: `250`
- is_active: `true`

## Site 3
- id: `site_003`
- company_id: `comp_safeguard_001`
- name: `Sea Point Residential Block`
- code: `SPR-01`
- address_line_1: `88 Beach Road`
- suburb: `Sea Point`
- city: `Cape Town`
- province: `Western Cape`
- country: `South Africa`
- latitude: `-33.9155`
- longitude: `18.3847`
- radius_meters: `120`
- is_active: `true`

---

# Seed Guard Assignments

## Active Assignments

### Assignment 1
- id: `assign_001`
- guard_id: `user_guard_001`
- site_id: `site_001`
- supervisor_id: `user_sup_001`
- shift_start: `2026-03-16T06:00:00Z`
- shift_end: `2026-03-16T18:00:00Z`
- status: `active`

### Assignment 2
- id: `assign_002`
- guard_id: `user_guard_002`
- site_id: `site_002`
- supervisor_id: `user_sup_001`
- shift_start: `2026-03-16T06:00:00Z`
- shift_end: `2026-03-16T18:00:00Z`
- status: `active`

### Assignment 3
- id: `assign_003`
- guard_id: `user_guard_003`
- site_id: `site_003`
- supervisor_id: `user_sup_002`
- shift_start: `2026-03-16T18:00:00Z`
- shift_end: `2026-03-17T06:00:00Z`
- status: `active`

### Assignment 4
- id: `assign_004`
- guard_id: `user_guard_004`
- site_id: `site_001`
- supervisor_id: `user_sup_002`
- shift_start: `2026-03-16T18:00:00Z`
- shift_end: `2026-03-17T06:00:00Z`
- status: `active`

---

# Seed Patrol Routes

## Patrol Route 1
- id: `route_001`
- site_id: `site_001`
- name: `Retail Perimeter Patrol`
- description: `Main entrance, loading bay, generator room, east parking edge`
- checkpoints:
  - `Main Entrance`
  - `Loading Bay`
  - `Generator Room`
  - `East Parking`
- expected_duration_minutes: `25`
- is_active: `true`

## Patrol Route 2
- id: `route_002`
- site_id: `site_002`
- name: `Warehouse Outer Fence Patrol`
- description: `Front gate, warehouse north wall, rear fence, transformer room`
- checkpoints:
  - `Front Gate`
  - `North Wall`
  - `Rear Fence`
  - `Transformer Room`
- expected_duration_minutes: `30`
- is_active: `true`

## Patrol Route 3
- id: `route_003`
- site_id: `site_003`
- name: `Residential Access Patrol`
- description: `Lobby, parking ramp, service corridor, roof access door`
- checkpoints:
  - `Lobby`
  - `Parking Ramp`
  - `Service Corridor`
  - `Roof Access Door`
- expected_duration_minutes: `20`
- is_active: `true`

---

# Seed Check-In Rules

These rules define how verification should behave for the MVP.

## Rule Set 1
- id: `rule_001`
- site_id: `site_001`
- checkin_window_minutes_before: `15`
- checkin_window_minutes_after: `20`
- require_location: `true`
- require_photo: `false`
- allow_manual_supervisor_override: `true`

## Rule Set 2
- id: `rule_002`
- site_id: `site_002`
- checkin_window_minutes_before: `15`
- checkin_window_minutes_after: `15`
- require_location: `true`
- require_photo: `true`
- allow_manual_supervisor_override: `true`

## Rule Set 3
- id: `rule_003`
- site_id: `site_003`
- checkin_window_minutes_before: `20`
- checkin_window_minutes_after: `30`
- require_location: `true`
- require_photo: `false`
- allow_manual_supervisor_override: `true`

---

# Seed Messages

These are raw inbound WhatsApp-style messages used for development and testing.

## Message 1 - Check-in text
- id: `msg_001`
- user_id: `user_guard_001`
- phone_e164: `+27720000001`
- direction: `inbound`
- message_type: `text`
- text_body: `checkin`
- whatsapp_message_id: `wamid.seed.001`
- received_at: `2026-03-16T06:02:00Z`

## Message 2 - Location for check-in
- id: `msg_002`
- user_id: `user_guard_001`
- phone_e164: `+27720000001`
- direction: `inbound`
- message_type: `location`
- latitude: `-33.9804`
- longitude: `18.4655`
- whatsapp_message_id: `wamid.seed.002`
- received_at: `2026-03-16T06:02:30Z`

## Message 3 - Patrol text
- id: `msg_003`
- user_id: `user_guard_002`
- phone_e164: `+27720000002`
- direction: `inbound`
- message_type: `text`
- text_body: `patrol done warehouse north sector`
- whatsapp_message_id: `wamid.seed.003`
- received_at: `2026-03-16T08:15:00Z`

## Message 4 - Incident text
- id: `msg_004`
- user_id: `user_guard_003`
- phone_e164: `+27720000003`
- direction: `inbound`
- message_type: `text`
- text_body: `incident suspicious person at rear entrance`
- whatsapp_message_id: `wamid.seed.004`
- received_at: `2026-03-16T21:40:00Z`

## Message 5 - Incident location
- id: `msg_005`
- user_id: `user_guard_003`
- phone_e164: `+27720000003`
- direction: `inbound`
- message_type: `location`
- latitude: `-33.9156`
- longitude: `18.3849`
- whatsapp_message_id: `wamid.seed.005`
- received_at: `2026-03-16T21:40:20Z`

## Message 6 - Incident photo
- id: `msg_006`
- user_id: `user_guard_003`
- phone_e164: `+27720000003`
- direction: `inbound`
- message_type: `image`
- media_id: `media_seed_001`
- media_url: `https://storage.local/incidents/seed-001.jpg`
- whatsapp_message_id: `wamid.seed.006`
- received_at: `2026-03-16T21:40:35Z`

---

# Seed Events

These are structured events produced by the event engine.

## Event 1 - Verified Check-In
- id: `evt_001`
- company_id: `comp_safeguard_001`
- site_id: `site_001`
- user_id: `user_guard_001`
- assignment_id: `assign_001`
- route_id: `null`
- event_type: `checkin`
- source_message_ids:
  - `msg_001`
  - `msg_002`
- status: `verified`
- verification_state: `verified`
- verification_reason: `Location within site radius and within allowed time window`
- latitude: `-33.9804`
- longitude: `18.4655`
- event_time: `2026-03-16T06:02:30Z`

## Event 2 - Unverified Patrol Update
- id: `evt_002`
- company_id: `comp_safeguard_001`
- site_id: `site_002`
- user_id: `user_guard_002`
- assignment_id: `assign_002`
- route_id: `route_002`
- event_type: `patrol_complete`
- source_message_ids:
  - `msg_003`
- status: `needs_review`
- verification_state: `unverified`
- verification_reason: `No location attached to patrol completion message`
- latitude: `null`
- longitude: `null`
- event_time: `2026-03-16T08:15:00Z`

## Event 3 - Verified Incident
- id: `evt_003`
- company_id: `comp_safeguard_001`
- site_id: `site_003`
- user_id: `user_guard_003`
- assignment_id: `assign_003`
- route_id: `null`
- event_type: `incident_reported`
- source_message_ids:
  - `msg_004`
  - `msg_005`
  - `msg_006`
- status: `open`
- verification_state: `verified`
- verification_reason: `Incident includes matching location and photo evidence`
- latitude: `-33.9156`
- longitude: `18.3849`
- event_time: `2026-03-16T21:40:35Z`

---

# Seed Incidents

## Incident 1
- id: `inc_001`
- company_id: `comp_safeguard_001`
- site_id: `site_003`
- event_id: `evt_003`
- reported_by_user_id: `user_guard_003`
- assigned_supervisor_id: `user_sup_002`
- severity: `high`
- title: `Suspicious person at rear entrance`
- description: `Guard reported a suspicious person near the rear entrance of the residential block. Photo evidence attached.`
- status: `open`
- latitude: `-33.9156`
- longitude: `18.3849`
- primary_media_url: `https://storage.local/incidents/seed-001.jpg`
- reported_at: `2026-03-16T21:40:35Z`

---

# Seed Media

## Media 1
- id: `media_001`
- company_id: `comp_safeguard_001`
- uploaded_by_user_id: `user_guard_003`
- related_event_id: `evt_003`
- related_incident_id: `inc_001`
- media_type: `image`
- storage_path: `incidents/2026/03/16/seed-001.jpg`
- public_url: `https://storage.local/incidents/seed-001.jpg`
- uploaded_at: `2026-03-16T21:40:35Z`

---

# Seed Notifications

## Notification 1
- id: `notif_001`
- company_id: `comp_safeguard_001`
- user_id: `user_sup_001`
- event_id: `evt_002`
- incident_id: `null`
- channel: `dashboard`
- severity: `medium`
- title: `Unverified patrol update`
- body: `Patrol completion from Thabo Mokoena could not be verified because no location was provided.`
- status: `unread`
- created_at: `2026-03-16T08:15:10Z`

## Notification 2
- id: `notif_002`
- company_id: `comp_safeguard_001`
- user_id: `user_sup_002`
- event_id: `evt_003`
- incident_id: `inc_001`
- channel: `dashboard`
- severity: `high`
- title: `High-severity incident reported`
- body: `Anele Jacobs reported a suspicious person at Sea Point Residential Block. Review incident immediately.`
- status: `unread`
- created_at: `2026-03-16T21:40:40Z`

---

# Suggested Dashboard State from Seed Data

The seeded UI should show:

## Dashboard
- total active guards: `4`
- open incidents: `1`
- verified events today: `2`
- unverified events today: `1`

## Guards Page
- Sipho Dlamini: checked in successfully
- Thabo Mokoena: patrol submitted, needs review
- Anele Jacobs: incident reported
- Lutho Ndlovu: active shift, no recent event

## Incidents Page
- one open high-severity incident with image and map point

## Activity Feed
- verified check-in
- unverified patrol completion
- high-severity incident report

---

# Seeder Implementation Guidance

The seeder should:

1. Insert company first
2. Insert users
3. Insert sites
4. Insert assignments
5. Insert patrol routes
6. Insert check-in rules
7. Insert raw messages
8. Insert structured events
9. Insert incidents
10. Insert media
11. Insert notifications

Maintain referential integrity at all times.

---

# Notes for Developers

- Use stable IDs in development so frontend mocks and tests remain predictable
- Use these records for local development, integration tests, and demo environments
- Keep seed data small and readable
- Update this file when schema changes