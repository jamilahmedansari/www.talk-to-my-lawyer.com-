# www.talk-to-my-lawyer.com- Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches development patterns for a legal tech SaaS platform built with TypeScript, Vite, and a modern full-stack architecture. The platform features AI-powered letter generation, Stripe payment integration, role-based access control, and a comprehensive review workflow. The codebase follows a checkpoint-driven development approach with extensive testing and documentation practices.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Test files follow pattern: `*.test.ts`
- Component files use `.tsx` extension
- Server files use `.ts` extension

### Import Style
```typescript
// Use alias imports
import { SomeType } from '@/shared/types'
import { trpc } from '@/utils/trpc'
```

### Export Style
```typescript
// Mixed export patterns
export const someFunction = () => { ... }
export default ComponentName
export type { TypeName }
```

### Commit Conventions
- **Prefixes:** checkpoint, feat, chore, docs
- **Style:** Freeform descriptive messages
- **Length:** Average 222 characters with detailed context

## Workflows

### Feature Development Checkpoint
**Trigger:** When implementing a major feature or completing a development phase  
**Command:** `/checkpoint-feature`

1. Implement core feature functionality across frontend and backend
2. Add comprehensive test suite (40-65 tests per feature)
3. Update `todo.md` with completion status and next steps
4. Create checkpoint commit with detailed implementation summary

```typescript
// Example test structure
describe('New Feature Phase', () => {
  test('should handle core functionality', async () => {
    // Comprehensive test coverage
  })
})
```

### Stripe Payment Integration
**Trigger:** When adding new payment features or modifying billing logic  
**Command:** `/add-payment-flow`

1. Update `server/stripe.ts` with new checkout/payment methods
2. Modify `server/stripeWebhook.ts` to handle new webhook events
3. Update `server/routers/billing.ts` with new tRPC procedures
4. Add frontend payment components or update existing paywall components

```typescript
// Example payment flow
export const createCheckoutSession = async (priceId: string) => {
  const session = await stripe.checkout.sessions.create({
    // Configuration
  })
  return session
}
```

### Database Schema Migration
**Trigger:** When database structure needs to change  
**Command:** `/add-database-table`

1. Create migration SQL file in `drizzle/` directory
2. Update `drizzle/schema.ts` with new schema definitions
3. Update `server/db.ts` with new database functions
4. Update `shared/types.ts` if new types are needed

```sql
-- Example migration
ALTER TABLE users ADD COLUMN new_field VARCHAR(255);
```

```typescript
// Schema update
export const newTable = pgTable('new_table', {
  id: serial('id').primaryKey(),
  // Additional columns
})
```

### Authentication & RBAC Enhancement
**Trigger:** When adding new user roles or authentication features  
**Command:** `/add-auth-feature`

1. Update `server/supabaseAuth.ts` with auth logic changes
2. Modify `server/routers/auth.ts` with new auth procedures
3. Update client auth pages (Login, Signup, Profile)
4. Add or modify role guards in `server/routers/_guards.ts`

```typescript
// Example role guard
export const requireRole = (role: UserRole) => {
  return middleware(({ ctx, next }) => {
    if (!ctx.user || ctx.user.role !== role) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    return next()
  })
}
```

### Pipeline Workflow Enhancement
**Trigger:** When updating letter generation logic or review workflows  
**Command:** `/update-pipeline`

1. Update `server/pipeline.ts` with new generation logic
2. Modify `shared/types.ts` for new status transitions
3. Update `server/routers/letters.ts` or `server/routers/review.ts`
4. Update frontend letter detail pages to handle new statuses

```typescript
// Example pipeline status
export enum LetterStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  REVIEW_PENDING = 'review_pending',
  APPROVED = 'approved'
}
```

### Documentation & Skill Creation
**Trigger:** When documenting system architecture or creating agent skills  
**Command:** `/create-skill-docs`

1. Create or update SKILL.md files in `docs/skills/`
2. Add reference documentation files
3. Update main documentation files (README, ARCHITECTURE, etc.)
4. Create instinct files for continuous learning in `.claude/`

### Frontend Page & Component Update
**Trigger:** When adding UI features or fixing frontend issues  
**Command:** `/update-frontend-pages`

1. Update subscriber pages in `client/src/pages/subscriber/`
2. Update admin or employee pages as needed
3. Create or update reusable components
4. Update routing in `client/src/App.tsx` if needed

```tsx
// Example component pattern
export const FeatureComponent: React.FC<Props> = ({ prop }) => {
  const mutation = trpc.feature.create.useMutation()
  
  return (
    <div>
      {/* Component JSX */}
    </div>
  )
}
```

## Testing Patterns

### Test Structure
- Framework: **vitest**
- Pattern: `*.test.ts` files
- Comprehensive suites: 40-65 tests per major feature
- Focus on integration and functionality testing

```typescript
// Example test pattern
describe('Feature Tests', () => {
  beforeEach(() => {
    // Setup
  })
  
  test('should handle success case', async () => {
    // Test implementation
    expect(result).toBeDefined()
  })
  
  test('should handle error case', async () => {
    // Error testing
  })
})
```

## Commands

| Command | Purpose |
|---------|---------|
| `/checkpoint-feature` | Complete feature implementation with testing and docs |
| `/add-payment-flow` | Integrate new Stripe payment functionality |
| `/add-database-table` | Create database migrations and schema updates |
| `/add-auth-feature` | Enhance authentication and role-based access |
| `/update-pipeline` | Modify AI letter generation or review workflows |
| `/create-skill-docs` | Generate comprehensive documentation |
| `/update-frontend-pages` | Update UI components across user roles |