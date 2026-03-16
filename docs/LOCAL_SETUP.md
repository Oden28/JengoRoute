# Local Setup

## Required Services

- Node.js
- Python 3.11+
- Redis
- Supabase project
- Meta WhatsApp Cloud API app

## Environment Variables

### Backend
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`
- `SENTRY_DSN`

### Frontend
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_MAP_PROVIDER`
- `NEXT_PUBLIC_MAPBOX_TOKEN` (if Mapbox is used)

## Local Run Order

1. start Redis
2. run backend API
3. run worker
4. run frontend
5. expose webhook using a tunnel if needed
6. configure Meta webhook to point to tunnel URL

## Notes

- use sample payloads for local testing
- store webhook payloads for debugging
- start with seeded data for companies, sites, and guards