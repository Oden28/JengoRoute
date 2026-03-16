# Build Tasks

## Phase 1: Project Scaffold
- create backend structure
- create frontend structure
- create config modules
- create docs references
- add env examples

## Phase 2: WhatsApp Ingestion
- implement webhook route
- validate payload shape
- enqueue jobs
- add outbound WhatsApp service stub

## Phase 3: Queue and Worker
- configure Redis
- implement RQ worker
- implement job processing flow

## Phase 4: Database and Storage
- create schema
- connect Supabase
- add media upload flow
- persist raw messages

## Phase 5: Event Engine
- implement normalization
- implement classification
- implement check-in flow
- implement patrol flow
- implement incident flow

## Phase 6: Verification Layer
- implement assignment lookup
- implement location radius checks
- implement time-window checks
- implement verification result persistence

## Phase 7: Dashboard
- implement dashboard summary
- implement incidents page
- implement guards page
- implement activity feed
- implement map markers

## Phase 8: Notifications
- implement incident alert flow
- implement unverified check-in alert flow
- add test notification route

## Phase 9: Testing and Seed Data
- add seed company, guards, sites
- add example assignments
- add local test payloads
- verify full end-to-end flow