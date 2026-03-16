# Events and Workflows

## Purpose

This file defines how raw WhatsApp inputs become structured events.

## Core Event Types

### 1. Check-In
Represents a guard reporting arrival or presence.

Common text examples:
- checkin
- check in
- check-in
- checked in
- arrived
- on site

Expected supporting data:
- location strongly preferred
- photo optional for MVP
- timestamp always captured by system

Output:
- event_type = checkin

Verification logic:
- if no location: mark pending_review or unverified
- if location outside assigned radius: unverified
- if within shift window and within radius: verified
- if no assignment found: pending_review

### 2. Patrol
Represents patrol completion or patrol progress.

Common text examples:
- patrol done
- patrol complete
- sector a complete
- patrol done sector x

Expected supporting data:
- optional location
- description from text

Output:
- event_type = patrol

Verification logic:
- if location available, compare to site or patrol area
- if no location, allow pending_review

### 3. Incident
Represents a security issue requiring review or response.

Common text examples:
- incident
- break-in
- suspicious person
- gate damaged
- alarm triggered

Expected supporting data:
- text description
- optional location
- optional photo
- timestamp required

Output:
- event_type = incident
- create incident detail record

Severity logic for MVP:
- if text contains “armed”, “weapon”, “attack”, “fire”: critical
- if text contains “break”, “damage”, “forced entry”: high
- otherwise default medium unless manually changed

Notification logic:
- send supervisor alert immediately for high or critical incidents
- create dashboard highlight for all incidents

## Parsing Rules

### Message Normalization
Normalize text by:
- trimming whitespace
- converting to lowercase
- removing duplicate spaces

### Classification Priority
Process messages in this order:
1. incident
2. checkin
3. patrol
4. generic_update

Reason:
Incident detection is highest priority.

### Multi-part Messages
If a user sends:
- text + location
- text + image
- text + location + image

The processor should attempt to link them within a short time window if they belong to the same reporting sequence.

MVP approach:
- keep it simple
- group recent messages from same sender within a configurable short window if necessary
- otherwise create best-effort event from current message

## Verification Workflow

Inputs:
- user assignment
- site/post coordinates
- event coordinates
- event timestamp
- presence of photo

Checks:
1. is assignment known?
2. is location present?
3. is event within allowed radius?
4. is event within shift window?
5. is photo present if required?

Outputs:
- verified
- unverified
- pending_review

## Alert Workflow

Trigger supervisor alert when:
- incident created
- check-in unverified
- location missing on required check-in
- event marked critical

## Fallback Workflow

If a message cannot be confidently classified:
- store raw message
- create optional generic_update event or leave unclassified
- do not discard data