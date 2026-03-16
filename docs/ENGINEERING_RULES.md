# Engineering Rules

## Primary Rule

Build for correctness and clarity first. Do not optimize for polish or abstraction.

## General Rules

1. Keep webhook handlers thin.
2. Put business logic in service modules.
3. Store raw data before transforming it.
4. Use explicit domain models and statuses.
5. Prefer simple, direct code over clever abstractions.
6. Use environment variables for secrets and configuration.
7. Comment non-obvious logic.
8. Keep functions small and testable.
9. Fail safely and log useful context.
10. Design for MVP iteration, not theoretical scale.

## Backend Rules

- FastAPI handles HTTP only
- worker handles background processing
- event logic must not live in route handlers
- verification logic must be isolated and explicit
- outbound WhatsApp code should be wrapped in a dedicated service

## Database Rules

- use clear table names
- use enums or constrained text values where useful
- avoid denormalization unless necessary for MVP simplicity
- always keep source message linkage when possible

## Frontend Rules

- prioritize operational visibility
- no heavy design systems needed initially
- pages should map directly to supervisor use cases
- avoid unnecessary client complexity

## Infra Rules

- Railway for backend
- Vercel for frontend
- Supabase for DB/storage
- Redis for queue
- Sentry for monitoring

## Scope Discipline

Do not add:
- AI chat assistant behavior unless explicitly requested
- advanced scheduling engine
- multi-tenant billing
- native mobile app
- heavy microservice decomposition

## Code Generation Preference

When generating code:
- scaffold complete modules
- include comments
- include example env vars
- include sample seed data where helpful
- generate runnable code whenever possible