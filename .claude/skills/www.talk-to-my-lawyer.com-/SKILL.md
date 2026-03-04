# www.talk-to-my-lawyer.com- Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill covers development patterns for a legal tech web application built with TypeScript and Vite. The codebase follows a full-stack architecture with tRPC for API communication, Drizzle for database management, Stripe for payments, and Supabase for authentication. The application includes client-side React components, server-side API routers, and comprehensive database schema management.

## Coding Conventions

### File Naming
- Use **camelCase** for all files: `userProfile.tsx`, `billingRouter.ts`
- Test files follow pattern: `*.test.ts`
- Migration files in `drizzle/` use descriptive SQL names

### Import Style
- Use **alias imports** with path mapping
- Example: `import { UserType } from '@/shared/types'`

### Export Style
- **Mixed exports** - both default and named exports are used
- Components typically use default export
- Utilities and types use named exports

### Commit Messages
- **Freeform style** with common prefixes: `checkpoint`, `feat`, `chore`, `docs`
- Average length: 222 characters
- Be descriptive about changes made

## Workflows

### Database Schema Migration
**Trigger:** When database structure needs to change
**Command:** `/migrate-db`

1. Create migration SQL file in `drizzle/` directory
2. Update `drizzle/schema.ts` with new tables/columns
3. Update `drizzle/meta/` snapshot files to reflect changes
4. Update `shared/types.ts` if new TypeScript types are needed
5. Update `server/db.ts` with new helper functions for database operations

**Example schema update:**
```typescript
// drizzle/schema.ts
export const newTable = pgTable('new_table', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});
```

### tRPC Router Procedure Addition
**Trigger:** When adding new API endpoints or business logic
**Command:** `/add-procedure`

1. Add procedure to appropriate router file in `server/routers/`
2. Update `shared/types.ts` if new types are needed
3. Add corresponding database helper function in `server/db.ts`
4. Update client pages to use the new procedure

**Example procedure:**
```typescript
// server/routers/example.ts
export const exampleRouter = t.router({
  getProcedure: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await db.getExample(input.id);
    })
});
```

### Mobile Responsiveness Fixes
**Trigger:** When pages need mobile optimization
**Command:** `/make-responsive`

1. Identify `grid-cols-X` classes without responsive prefixes
2. Replace with `grid-cols-1 sm:grid-cols-X` pattern for mobile-first design
3. Update flex layouts with responsive variants (`flex-col md:flex-row`)
4. Test across mobile breakpoints (sm, md, lg)

**Example responsive grid:**
```tsx
// Before
<div className="grid grid-cols-3 gap-4">

// After
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Stripe Integration Enhancement
**Trigger:** When payment features need modification
**Command:** `/update-payments`

1. Update `server/stripe.ts` for new checkout logic
2. Modify `server/stripeWebhook.ts` webhook handlers
3. Update `server/routers/billing.ts` procedures
4. Enhance client payment UI components

**Key files:**
- `client/src/pages/subscriber/Billing.tsx`
- `client/src/components/LetterPaywall.tsx`

### Comprehensive Feature Phase
**Trigger:** When implementing major functionality
**Command:** `/new-feature-phase`

1. Update multiple related files across client and server
2. Add new React components and pages as needed
3. Update database schema if required
4. Create comprehensive test file following `phase*.test.ts` pattern
5. Update `todo.md` with progress checkpoint

**Testing example:**
```typescript
// server/phaseX.test.ts
import { describe, it, expect } from 'vitest';

describe('Phase X Feature', () => {
  it('should handle new functionality', async () => {
    // Comprehensive test coverage
  });
});
```

### Admin Dashboard Enhancement
**Trigger:** When admin users need new capabilities
**Command:** `/enhance-admin`

1. Update admin pages in `client/src/pages/admin/*.tsx`
2. Add new admin procedures to `server/routers/admin.ts`
3. Update `server/db.ts` with admin helper functions
4. Enhance RBAC checks in `server/routers/_guards.ts`

### Authentication System Updates
**Trigger:** When auth features need changes
**Command:** `/update-auth`

1. Update `server/supabaseAuth.ts` authentication logic
2. Modify `server/routers/auth.ts` procedures
3. Update client auth pages (`Login.tsx`, `Signup.tsx`)
4. Update `client/src/_core/hooks/useAuth.ts` if needed

## Testing Patterns

### Framework
- **Vitest** for testing framework
- Test files use `*.test.ts` pattern
- Phase-based testing with `phase*.test.ts` for major features

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should perform expected behavior', async () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## Commands

| Command | Purpose |
|---------|---------|
| `/migrate-db` | Handle database schema changes and migrations |
| `/add-procedure` | Add new tRPC API procedures with full stack integration |
| `/make-responsive` | Convert layouts to mobile-responsive designs |
| `/update-payments` | Modify Stripe payment flows and billing features |
| `/new-feature-phase` | Implement comprehensive multi-component features |
| `/enhance-admin` | Add admin dashboard functionality and management |
| `/update-auth` | Modify authentication flows and user management |