# manus-talk-to-my-lawyer Development Patterns

> Auto-generated skill from repository analysis

## Overview

This is a TypeScript-based legal tech application built with Vite, featuring a full-stack architecture with tRPC API, Drizzle ORM database management, Stripe payment integration, and comprehensive email notifications. The codebase follows a phase-driven development approach with extensive testing and documentation practices.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Test files follow pattern: `*.test.*`
- Phase-based test files: `phase*.test.ts`

### Import/Export Style
```typescript
// Mixed export style - use as appropriate
export default function Component() { }
export const utility = () => { }

// Alias imports preferred
import { something as alias } from './module'
```

### Commit Messages
- Average length: ~271 characters
- Common prefixes: `checkpoint`, `docs`
- Include test counts and TypeScript error status
- Example: `checkpoint: phase 3 complete - user management with 25 tests passing, 0 TS errors`

## Workflows

### Phase Development Cycle
**Trigger:** When implementing a new feature or major change  
**Command:** `/phase-complete`

1. Implement feature changes across relevant files
2. Add comprehensive test file (`phase*.test.ts`) with 10-50+ test cases
3. Update `todo.md` with completion status and progress tracking
4. Create checkpoint commit with phase number and detailed summary
5. Ensure all tests pass and 0 TypeScript errors before committing

```typescript
// Example test structure
describe('Phase 5: Advanced Features', () => {
  test('happy path scenario', async () => {
    // Implementation
  });
  
  test('edge case handling', async () => {
    // Error scenarios
  });
});
```

### Database Schema Migration
**Trigger:** When database schema changes are needed  
**Command:** `/add-table`

1. Update `drizzle/schema.ts` with new tables/columns using Drizzle syntax
2. Generate migration SQL file in `drizzle/` directory
3. Update `drizzle/meta/` snapshot and journal files
4. Apply migration to database
5. Update `server/db.ts` with new query functions

```typescript
// Example schema addition
export const newTable = pgTable('new_table', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow()
});
```

### Email Template Implementation
**Trigger:** When adding a new email notification feature  
**Command:** `/add-email-template`

1. Add email template function to `server/email.ts`
2. Wire email trigger into relevant router procedure
3. Add comprehensive tests for email functionality
4. Update `todo.md` with feature completion
5. Ensure fire-and-forget error handling for email sending

```typescript
// Example email template
export const sendNotificationEmail = async (to: string, data: any) => {
  try {
    // Email implementation with error handling
  } catch (error) {
    // Fire-and-forget: log but don't throw
    console.error('Email send failed:', error);
  }
};
```

### Frontend Page Development
**Trigger:** When adding new user-facing functionality  
**Command:** `/add-page`

1. Create or update page component in `client/src/pages/`
2. Update `App.tsx` with new route configuration
3. Add navigation links in `AppLayout.tsx` if needed
4. Update `ProtectedRoute.tsx` for role-based access control
5. Add UI components and styling with consistent patterns

```typescript
// Example route addition
<Route path="/new-feature" element={
  <ProtectedRoute allowedRoles={['admin', 'user']}>
    <NewFeaturePage />
  </ProtectedRoute>
} />
```

### tRPC Procedure Addition
**Trigger:** When adding new backend API functionality  
**Command:** `/add-api-endpoint`

1. Add procedure to appropriate router in `server/routers/`
2. Add database query functions to `server/db.ts`
3. Add input/output type definitions to `shared/types.ts`
4. Wire frontend calls to new procedures using tRPC hooks
5. Add comprehensive test coverage for all scenarios

```typescript
// Example tRPC procedure
export const userRouter = router({
  create: publicProcedure
    .input(createUserSchema)
    .output(userSchema)
    .mutation(async ({ input }) => {
      return await createUser(input);
    })
});
```

### Comprehensive Testing Suite
**Trigger:** When completing feature development  
**Command:** `/add-comprehensive-tests`

1. Create `phase*.test.ts` file with descriptive name
2. Add 10-50+ test cases covering happy path and edge cases
3. Test database operations, API endpoints, and error handling
4. Verify TypeScript compilation and all tests passing
5. Update test count in commit messages for tracking

### Stripe Payment Integration
**Trigger:** When adding payment or billing functionality  
**Command:** `/add-payment-flow`

1. Update `server/stripe.ts` with new checkout functions
2. Add webhook handling in `server/stripeWebhook.ts`
3. Update `server/stripe-products.ts` with product definitions
4. Add frontend payment UI components with error handling
5. Add database tracking for payments and subscriptions

```typescript
// Example Stripe integration
export const createCheckoutSession = async (priceId: string, customerId: string) => {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription'
  });
  return session;
};
```

### Documentation Maintenance
**Trigger:** When major features are complete or architecture changes  
**Command:** `/update-docs`

1. Update `README.md` with new features and setup instructions
2. Add or update `docs/` files (`ARCHITECTURE.md`, `CONTRIBUTING.md`, etc.)
3. Create detailed documentation with practical examples
4. Update `todo.md` with progress tracking and next steps
5. Add validation reports and comprehensive audit documentation

## Testing Patterns

- Test files use pattern: `*.test.*`
- Phase-based testing: `phase*.test.ts` with descriptive names
- Aim for 10-50+ test cases per major feature
- Cover happy paths, edge cases, and error scenarios
- Test database operations and API endpoints thoroughly
- Ensure 0 TypeScript errors before committing

```typescript
// Standard test structure
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  test('happy path', async () => {
    // Main functionality test
  });

  test('error handling', async () => {
    // Error scenario test
  });
});
```

## Commands

| Command | Purpose |
|---------|---------|
| `/phase-complete` | Complete a development phase with testing and documentation |
| `/add-table` | Add new database schema with Drizzle migrations |
| `/add-email-template` | Implement new email notification with template |
| `/add-page` | Create new frontend page with routing |
| `/add-api-endpoint` | Add new tRPC procedure with validation |
| `/add-comprehensive-tests` | Create extensive test suite for features |
| `/add-payment-flow` | Implement Stripe payment integration |
| `/update-docs` | Maintain comprehensive project documentation |