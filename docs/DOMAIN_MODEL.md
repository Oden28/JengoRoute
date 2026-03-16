# Domain Model

## Company
Represents a security company using the platform.

Fields:
- id
- name
- created_at
- updated_at

Relationships:
- has many users
- has many sites
- has many events

## User
Represents a person in the system.

Fields:
- id
- company_id
- full_name
- phone_number
- role (`guard`, `supervisor`, `admin`)
- active
- created_at

Relationships:
- belongs to company
- may have many messages
- may have many events
- may have many incidents

## Site
Represents a protected client location or operating site.

Fields:
- id
- company_id
- name
- address
- latitude
- longitude
- allowed_radius_meters
- active

Relationships:
- belongs to company
- has many posts
- has many assignments
- has many events

## Post
Represents a specific guard post or station within a site.

Fields:
- id
- site_id
- name
- latitude
- longitude
- allowed_radius_meters
- active

Relationships:
- belongs to site
- may have many assignments
- may have many events

## GuardAssignment
Represents a guard assigned to a site/post and shift window.

Fields:
- id
- user_id
- site_id
- post_id
- shift_start
- shift_end
- active

Relationships:
- belongs to user
- belongs to site
- optionally belongs to post

## Message
Represents the raw inbound or outbound WhatsApp message.

Fields:
- id
- company_id
- user_id
- direction (`inbound`, `outbound`)
- whatsapp_message_id
- message_type (`text`, `location`, `image`, `audio`, `interactive`, `unknown`)
- raw_payload_json
- text_body
- latitude
- longitude
- media_asset_id
- received_at
- created_at

Relationships:
- belongs to user
- may produce one or more events

## Event
Represents a structured operational record.

Fields:
- id
- company_id
- user_id
- site_id
- post_id
- source_message_id
- event_type (`checkin`, `patrol`, `incident`, `generic_update`)
- status (`verified`, `unverified`, `pending_review`)
- description
- latitude
- longitude
- occurred_at
- created_at

Relationships:
- belongs to user
- belongs to company
- optionally belongs to site/post
- may have one verification result
- may have one incident detail
- may have many media assets

## Incident
Represents incident-specific detail attached to an event.

Fields:
- id
- event_id
- severity (`low`, `medium`, `high`, `critical`)
- category
- description
- requires_escalation
- created_at

Relationships:
- belongs to event

## VerificationResult
Represents the reason an event was or was not trusted.

Fields:
- id
- event_id
- location_status (`match`, `mismatch`, `missing`)
- time_status (`within_window`, `outside_window`, `unknown`)
- photo_status (`provided`, `missing`, `not_required`)
- overall_status (`verified`, `unverified`, `pending_review`)
- notes
- created_at

Relationships:
- belongs to event

## MediaAsset
Represents stored media linked to a message or event.

Fields:
- id
- company_id
- message_id
- event_id
- storage_bucket
- storage_path
- mime_type
- public_url
- created_at

Relationships:
- may belong to message
- may belong to event

## State Principles

- raw messages are immutable records
- events are derived from messages
- verification is a separate explicit record
- incidents are specialized event detail