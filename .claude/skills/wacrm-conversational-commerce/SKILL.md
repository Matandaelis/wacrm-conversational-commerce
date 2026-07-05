```markdown
# wacrm-conversational-commerce Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns, coding conventions, and workflows for contributing to the `wacrm-conversational-commerce` TypeScript codebase. The repository focuses on conversational commerce features, with a backend powered by custom API routes and database migrations (Supabase). It emphasizes clear code organization, conventional commits, and thorough documentation.

## Coding Conventions

### File Naming

- Use **snake_case** for all file names.

  **Example:**
  ```
  src/lib/user_utils.ts
  src/components/settings/user_settings.tsx
  ```

### Import Style

- Use **alias imports** for modules.

  **Example:**
  ```typescript
  import { getUserById } from '@/lib/user_utils';
  ```

### Export Style

- Use **named exports** for all modules.

  **Example:**
  ```typescript
  // src/lib/user_utils.ts
  export function getUserById(id: string) { ... }
  export function updateUser(id: string, data: UserData) { ... }
  ```

### Commit Messages

- Follow the **conventional commit** format.
- Use the `feat` prefix for new features.
- Keep commit messages concise (average ~71 characters).

  **Example:**
  ```
  feat: add customer chat API endpoint and migration
  ```

## Workflows

### Add Feature with API Endpoints and Migrations

**Trigger:** When adding a new major feature that involves backend API and database changes  
**Command:** `/new-feature-api-migration`

1. **Create new API route files**  
   - Add files under `src/app/api/feature/route.ts`
   - Example:
     ```typescript
     // src/app/api/orders/route.ts
     export async function POST(req: Request) { ... }
     ```
2. **Update or add related components**  
   - Place under `src/components/settings/`
   - Example:
     ```tsx
     // src/components/settings/order_settings.tsx
     export function OrderSettings() { ... }
     ```
3. **Implement supporting library code**  
   - Add utilities or helpers under `src/lib/`
   - Example:
     ```typescript
     // src/lib/order_utils.ts
     export function calculateOrderTotal(order: Order) { ... }
     ```
4. **Update type definitions**  
   - Edit `src/types/index.ts` to include new types
   - Example:
     ```typescript
     // src/types/index.ts
     export interface Order { ... }
     ```
5. **Add a new database migration**  
   - Place SQL migration file under `supabase/migrations/`
   - Example:
     ```
     supabase/migrations/20240601_add_orders_table.sql
     ```

### Add Feature Documentation and Checklists

**Trigger:** When documenting a new feature, process, or checklist  
**Command:** `/new-docs`

1. **Create or update markdown documentation files**
   - Add guides, checklists, or verification notes as `.md` files
   - Example:
     ```
     docs/order_feature_guide.md
     docs/order_verification_checklist.md
     ```
2. **Commit with a descriptive message**
   - Reference the feature or process in the commit message
   - Example:
     ```
     feat: add documentation for order feature and checklist
     ```

## Testing Patterns

- **Test files** use the pattern `*.test.*`
- **Testing framework** is not explicitly detected; check for test runners in project dependencies.
- Place test files alongside the modules they test or in a dedicated `__tests__` directory.

  **Example:**
  ```
  src/lib/order_utils.test.ts
  ```

## Commands

| Command                     | Purpose                                                      |
|-----------------------------|--------------------------------------------------------------|
| /new-feature-api-migration  | Start a new feature involving API endpoints and migrations    |
| /new-docs                   | Add or update documentation, guides, or checklists           |
```
