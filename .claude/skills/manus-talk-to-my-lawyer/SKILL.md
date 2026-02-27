# manus-talk-to-my-lawyer Development Patterns

> Auto-generated skill from repository analysis

## Overview

This is a legal technology platform built with TypeScript, Vite, and tRPC that enables subscribers to communicate with lawyers through a structured letter system. The codebase follows a full-stack architecture with a React frontend, Node.js backend, Drizzle ORM for database operations, and Stripe for payment processing. The application manages letter workflows, subscription billing, and provides both subscriber and admin portals.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Test files follow pattern: `*.test.ts`
- Component files use `.tsx` extension
- Database files use descriptive names like `schema.ts`, `db.ts`

### Import/Export Style
```typescript
// Use alias imports
import { someFunction } from '@/utils/helpers'
import type { User } from '@/shared/types'

// Mixed export styles - both named and default exports
export const namedExport = () => {}
export default function Component() {}
```

### Commit Patterns
- Use descriptive freeform messages (avg 313 chars)
- Prefix major milestones with "checkpoint"
- Include test counts in checkpoint commits
- Example: "checkpoint: completed user authentication phase - 24 tests passing, 0 TypeScript errors"

## Workflows

### Phase Checkpoint Completion
**Trigger:** When finishing a major feature or phase of development  
**Command:** `/checkpoint-phase`

1. Implement all feature changes and ensure functionality works
2. Update `todo.md` with current phase status and next steps
3. Run full test suite using `vitest` and verify all tests pass
4. Check TypeScript compilation and resolve any type errors
5. Create checkpoint commit including test count summary
6. Update documentation if new APIs or features were added

Example commit: `checkpoint: subscriber portal enhancement complete - 28 tests passing, 0 TS errors`

### Database Schema Migration
**Trigger:** When adding new database features or modifying schema  
**Command:** `/add-db-table`

1. Update `drizzle/schema.ts` with new tables, columns, or relationships
```typescript
export const newTable = pgTable('new_table', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow()
})
```

2. Generate migration SQL file using Drizzle kit
3. Update `drizzle/meta/` snapshot files with schema changes
4. Modify `server/db.ts` to include new queries and operations
5. Add corresponding TypeScript types in `shared/types.ts`
6. Test database operations with new schema

### Subscriber Page Enhancement
**Trigger:** When adding new subscriber-facing features or improving existing ones  
**Command:** `/enhance-subscriber-page`

1. Create or modify page component in `client/src/pages/subscriber/`
2. Add route to `client/src/App.tsx` routing configuration
3. Update `client/src/components/shared/AppLayout.tsx` sidebar navigation if needed
4. Implement polling or real-time updates for dynamic content
5. Update related shared components that the page depends on
6. Test user flow and ensure consistent styling with existing pages

### tRPC API Endpoint Addition
**Trigger:** When adding new backend functionality or data operations  
**Command:** `/add-trpc-endpoint`

1. Add new procedure to `server/routers.ts` with proper input validation
```typescript
newEndpoint: publicProcedure
  .input(z.object({ userId: z.number(), data: z.string() }))
  .query(async ({ input }) => {
    return await db.getData(input.userId, input.data)
  })
```

2. Implement business logic in `server/db.ts` or create dedicated service files
3. Add Zod validation schemas for input/output types
4. Write comprehensive tests in `server/*.test.ts` files
5. Update frontend components to consume the new endpoint using tRPC hooks

### Status Workflow Enhancement
**Trigger:** When adding new letter statuses or modifying status transitions  
**Command:** `/add-letter-status`

1. Update status enums and types in `drizzle/schema.ts`
2. Modify `server/pipeline.ts` routing logic to handle new status
3. Update `client/src/components/shared/StatusTimeline.tsx` to display new status
4. Update status handling in `client/src/pages/subscriber/LetterDetail.tsx`
5. Add corresponding admin controls in `client/src/pages/admin/LetterDetail.tsx`
6. Test status transitions and ensure proper email notifications

### Payment Integration Update
**Trigger:** When changing pricing, payment flows, or subscription models  
**Command:** `/update-payment-flow`

1. Update `server/stripe.ts` with new payment logic and product handling
2. Modify webhook handlers in `server/stripeWebhook.ts` for new events
3. Update `server/stripe-products.ts` configuration with new pricing
4. Update payment UI in `client/src/components/LetterPaywall.tsx`
5. Modify billing page in `client/src/pages/subscriber/Billing.tsx`
6. Test end-to-end payment flows including success and failure scenarios

## Testing Patterns

### Test Framework
- Uses **Vitest** as the testing framework
- Test files follow pattern: `*.test.ts`
- Located primarily in `server/` directory for backend API testing

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup test data
  })

  it('should perform expected behavior', async () => {
    // Arrange
    const input = { userId: 1 }
    
    // Act
    const result = await apiCall(input)
    
    // Assert
    expect(result).toEqual(expectedOutput)
  })
})
```

## Commands

| Command | Purpose |
|---------|---------|
| `/checkpoint-phase` | Complete a development phase with testing and documentation |
| `/add-db-table` | Add new database schema with proper migrations |
| `/enhance-subscriber-page` | Create or improve subscriber portal pages |
| `/add-trpc-endpoint` | Add new backend API endpoints with validation |
| `/add-letter-status` | Add or modify letter status workflows |
| `/update-payment-flow` | Modify Stripe payment integration and flows |