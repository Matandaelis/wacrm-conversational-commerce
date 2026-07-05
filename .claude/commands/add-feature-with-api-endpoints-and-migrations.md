---
name: add-feature-with-api-endpoints-and-migrations
description: Workflow command scaffold for add-feature-with-api-endpoints-and-migrations in wacrm-conversational-commerce.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-feature-with-api-endpoints-and-migrations

Use this workflow when working on **add-feature-with-api-endpoints-and-migrations** in `wacrm-conversational-commerce`.

## Goal

Implements a new feature that requires new API endpoints, updates to configuration components, library code, type definitions, and a corresponding database migration.

## Common Files

- `src/app/api/*/route.ts`
- `src/components/settings/*.tsx`
- `src/lib/**/*.ts`
- `src/types/index.ts`
- `supabase/migrations/*.sql`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create new API route files under src/app/api/feature/route.ts
- Update or add related components under src/components/settings/
- Implement supporting library code under src/lib/
- Update type definitions in src/types/index.ts
- Add a new database migration file under supabase/migrations/

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.