# manus-talk-to-my-lawyer Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches development patterns for manus-talk-to-my-lawyer, a TypeScript/Vite-based legal technology platform. The codebase follows a phase-based development approach with comprehensive testing, structured database migrations, and integrated payment processing. The application appears to be a full-stack platform supporting multiple user roles (subscribers, employees, attorneys, admins) with email notifications, Stripe payments, and tRPC API architecture.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Test files follow pattern: `*.test.*`
- Phase-based test files: `phase*.test.ts`
- Database migrations: `drizzle/####_*.sql`

### Import/Export Style
```typescript
// Use alias imports
import { something } from '@/shared/types'
import { db } from '@/server/db'

// Mixed export style - both named and default exports
export const namedFunction = () => {}
export default ComponentName
```

### Commit Messages
- Average length: ~271 characters
- Common prefixes: `checkpoint`, `docs`
- Phase commits: `Phase X:` or `Checkpoint: Phase X:`
- Freeform descriptive style

## Workflows

### Phase Checkpoint Commit
**Trigger:** When finishing a major feature or improvement phase
**Command:** `/complete-phase`

1. Implement feature changes across multiple implementation files
2. Add comprehensive test coverage in `server/phase*.test.ts`
3. Run tests and validate all pass (document XXX/XXX tests passing)
4. Confirm 0 TypeScript errors with `tsc --noEmit`
5. Create checkpoint commit with descriptive message:
   ```
   Checkpoint: Phase X: [Feature description and testing summary]
   
   - Implemented [specific changes]
   - Added tests covering [test scenarios]  
   - XXX/XXX tests passing
   - 0 TypeScript errors
   ```
6. Update `todo.md` with completed phase progress

### Database Schema Migration
**Trigger:** When adding new database fields or tables
**Command:** `/add-db-column`

1. Update `drizzle/schema.ts` with new schema definitions:
   ```typescript
   export const newTable = pgTable('new_table', {
     id: serial('id').primaryKey(),
     newColumn: text('new_column').notNull(),
     createdAt: timestamp('created_at').defaultNow(),
   });
   ```
2. Generate migration SQL file: `drizzle/####_description.sql`
3. Update migration metadata in `drizzle/meta/*.json`
4. Update `drizzle/meta/_journal.json` with new migration entry
5. Apply migration to Supabase database (via MCP or direct SQL execution)
6. Update `server/db.ts` with new query functions if needed:
   ```typescript
   export const getNewTableData = async (id: number) => {
     return await db.select().from(newTable).where(eq(newTable.id, id));
   };
   ```

### Email Template Integration
**Trigger:** When adding new email notifications to the system
**Command:** `/add-email-template`

1. Add email template function to `server/email.ts`:
   ```typescript
   export const sendNewNotificationEmail = async (
     to: string,
     data: { name: string; details: string }
   ) => {
     // Branded email template implementation
   };
   ```
2. Wire email sending into relevant tRPC procedures in `server/routers.ts`:
   ```typescript
   .mutation(async ({ input, ctx }) => {
     const result = await someDbOperation(input);
     
     // Fire-and-forget email sending
     sendNewNotificationEmail(input.email, result).catch(console.error);
     
     return result;
   })
   ```
3. Add email template tests in `server/phase*.test.ts`
4. Update `todo.md` with email integration status
5. Ensure fire-and-forget error handling (errors caught and logged, don't block main flow)

### Frontend Page Updates
**Trigger:** When implementing frontend features that span multiple pages
**Command:** `/update-frontend-pages`

1. Update relevant page components in `client/src/pages/`:
   ```typescript
   // Ensure proper role-based rendering
   if (user?.role === 'attorney') {
     return <AttorneyView />;
   }
   ```
2. Modify shared components if needed in `client/src/components/`
3. Update routing in `client/src/App.tsx` if adding new routes
4. Ensure responsive design and mobile compatibility
5. Test across all user roles: subscriber, employee, attorney, admin
6. Verify navigation and permissions work correctly

### Stripe Payment Integration
**Trigger:** When adding new payment flows or modifying pricing
**Command:** `/update-stripe-integration`

1. Update `server/stripe.ts` with new checkout logic:
   ```typescript
   export const createCheckoutSession = async (priceId: string) => {
     return stripe.checkout.sessions.create({
       // Checkout configuration
     });
   };
   ```
2. Modify `server/stripeWebhook.ts` for webhook handling:
   ```typescript
   case 'checkout.session.completed':
     await handleCheckoutCompleted(event.data.object);
     break;
   ```
3. Update `shared/pricing.ts` with new pricing constants
4. Update frontend payment pages (`Pricing.tsx`, `Billing.tsx`, etc.)
5. Add commission tracking in `server/db.ts` if needed
6. Test payment flows end-to-end in Stripe test mode

### Documentation Update
**Trigger:** When documenting architecture, features, or development processes
**Command:** `/update-docs`

1. Create or update markdown files in `docs/` or root directory
2. Update `README.md` with project overview and setup instructions
3. Document system architecture in `ARCHITECTURE.md`
4. Update `todo.md` with current progress and next steps
5. Ensure documentation reflects current codebase state and deployment process
6. Include code examples and configuration details

### tRPC Procedure Addition
**Trigger:** When adding new API endpoints for frontend consumption
**Command:** `/add-trpc-procedure`

1. Add procedure definition to `server/routers.ts` or modular router files:
   ```typescript
   newProcedure: publicProcedure
     .input(z.object({
       field: z.string(),
     }))
     .query(async ({ input, ctx }) => {
       return await getSomeData(input.field);
     }),
   ```
2. Add input validation with Zod schemas for type safety
3. Implement database queries in `server/db.ts` if needed
4. Add comprehensive tests in `server/phase*.test.ts`:
   ```typescript
   test('newProcedure returns expected data', async () => {
     const result = await caller.newProcedure({ field: 'test' });
     expect(result).toMatchObject({ /* expected shape */ });
   });
   ```
5. Wire frontend calls to new procedures using tRPC hooks
6. Ensure proper role-based access control with middleware

## Testing Patterns

- Tests are organized by development phases: `phase*.test.ts`
- Comprehensive test coverage expected for each phase
- Test results documented in commit messages (XXX/XXX tests passing)
- TypeScript compilation must pass (0 errors) before commits
- Tests cover tRPC procedures, database operations, and email functionality

## Commands

| Command | Purpose |
|---------|---------|
| `/complete-phase` | Complete a development phase with comprehensive testing and checkpoint commit |
| `/add-db-column` | Add new database schema with proper Drizzle migration |
| `/add-email-template` | Integrate new branded email notifications with fire-and-forget sending |
| `/update-frontend-pages` | Update multiple frontend pages with role-based considerations |
| `/update-stripe-integration` | Modify payment flows and webhook handling |
| `/update-docs` | Create or update project documentation |
| `/add-trpc-procedure` | Add new API endpoints with validation and testing |