```markdown
# manus-talk-to-my-lawyer Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches development patterns for the manus-talk-to-my-lawyer application - a TypeScript/Vite-based legal tech platform that helps users generate demand letters through an AI-powered pipeline. The codebase follows a full-stack architecture with React frontend, Node.js backend, Drizzle ORM for database management, Stripe for payments, and comprehensive email automation.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Test files follow pattern `*.test.ts`
- Database migrations use timestamps

### Import/Export Style
```typescript
// Use import aliases for better organization
import type { User } from '@/shared/types';
import { db } from '@/server/db';

// Mixed export styles based on context
export const helper = () => {};  // Named exports for utilities
export default Component;       // Default for React components
```

### Commit Messages
- Use freeform style with descriptive context
- Prefix with "checkpoint" for milestone commits
- Include test counts and completion status
- Average ~316 characters with comprehensive details

Example:
```
checkpoint: pricing overhaul complete - added subscription tiers, updated billing flow, enhanced UI components (47 tests passing)
```

## Workflows

### Major Feature Development
**Trigger:** When developing substantial new features like pricing systems, email automation, or role-based access
**Command:** `/new-feature`

1. **Update Backend Types**: Modify `shared/types.ts` and `drizzle/schema.ts` for new data models
2. **Create Database Migration**: Generate and test migration SQL files
3. **Update Server Logic**: Modify `server/routers.ts` and related business logic files
4. **Build Client Components**: Create/update React components in `client/src/pages/`
5. **Add Comprehensive Tests**: Write unit and integration tests in `server/*.test.ts`
6. **Update Documentation**: Refresh README and inline documentation
7. **Update Todo**: Track completion status in `todo.md`

```typescript
// Example schema update
export const newFeatureTable = pgTable('new_feature', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  status: varchar('status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow()
});
```

### Database Schema Evolution
**Trigger:** When adding new tables, columns, or modifying database structure
**Command:** `/add-table`

1. **Update Schema**: Modify `drizzle/schema.ts` with new table/column definitions
2. **Generate Migration**: Run Drizzle generate command to create SQL migration
3. **Update Meta Snapshots**: Ensure `drizzle/meta/*.json` files are updated
4. **Update DB Helpers**: Add new functions to `server/db.ts` as needed
5. **Add Tests**: Create tests for new database operations

```typescript
// Schema example with relationships
export const lawyerLetters = pgTable('lawyer_letters', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  status: letterStatusEnum('status').default('draft'),
  generatedAt: timestamp('generated_at'),
  content: text('content')
});
```

### Checkpoint Commit
**Trigger:** When completing a development phase or major milestone
**Command:** `/checkpoint`

1. **Complete Implementation**: Ensure all feature code is finished and functional
2. **Run Full Test Suite**: Execute all tests and verify passing status
3. **TypeScript Compilation**: Confirm no type errors across codebase
4. **Write Detailed Commit**: Include test counts, completion status, and next steps
5. **Update Project Status**: Refresh `todo.md` with current progress and upcoming tasks

Example commit message:
```
checkpoint: email notification system complete - implemented 5 new templates, webhook handling, user preferences (52 tests passing, ready for production deploy)
```

### Email Template Development
**Trigger:** When adding new transactional emails or updating existing templates
**Command:** `/new-email-template`

1. **Update Email Service**: Add new template function to `server/email.ts`
2. **Add Styling**: Include branded HTML/CSS for professional appearance
3. **Update Router Logic**: Integrate email triggers in `server/routers.ts`
4. **Create Email Tests**: Add comprehensive tests for email generation and delivery
5. **Test Delivery**: Verify emails send correctly in development environment

```typescript
// Email template example
export const sendStatusUpdateEmail = async (user: User, status: string) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2>Letter Status Update</h2>
      <p>Your demand letter status has been updated to: <strong>${status}</strong></p>
    </div>
  `;
  
  await sendEmail({
    to: user.email,
    subject: 'Letter Status Update',
    html: htmlContent
  });
};
```

### UI Page Enhancement
**Trigger:** When improving user interface or adding client-side functionality
**Command:** `/update-ui`

1. **Modify Components**: Update React components in `client/src/pages/`
2. **Update Shared Components**: Modify reusable components as needed
3. **Add Styling**: Update `client/src/index.css` with new styles
4. **Test UI Changes**: Verify responsive design and user experience
5. **Update Related Tests**: Add/modify component tests if applicable

```tsx
// Component structure example
const EnhancedLetterStatus: React.FC<{ letterId: string }> = ({ letterId }) => {
  const { data: letter } = useQuery(['letter', letterId], fetchLetter);
  
  return (
    <div className="status-container">
      <StatusTimeline currentStatus={letter?.status} />
      <ActionButtons letter={letter} />
    </div>
  );
};
```

### Test Suite Expansion
**Trigger:** When implementing features that require comprehensive test validation
**Command:** `/add-tests`

1. **Create Test File**: Add new `*.test.ts` file in `server/` directory
2. **Write Unit Tests**: Test individual functions and methods thoroughly
3. **Add Integration Tests**: Test complete workflows and API endpoints
4. **Verify Test Coverage**: Ensure all new code paths are tested
5. **Update Test Counts**: Document passing tests in commit messages

```typescript
// Test example using vitest
describe('Letter Generation Pipeline', () => {
  it('should process letter through all stages', async () => {
    const letter = await createTestLetter();
    const result = await processPipeline(letter.id);
    
    expect(result.status).toBe('completed');
    expect(result.generatedContent).toBeTruthy();
  });
});
```

### Stripe Payment Integration
**Trigger:** When adding payment flows, subscription plans, or billing features
**Command:** `/update-payments`

1. **Update Stripe Service**: Modify `server/stripe.ts` with new payment logic
2. **Handle Webhooks**: Update `server/stripeWebhook.ts` for event processing
3. **Configure Products**: Update `server/stripe-products.ts` with new plans/pricing
4. **Build Payment UI**: Create/update billing components in client
5. **Test Payment Flows**: Verify subscription and payment processing works correctly

```typescript
// Stripe integration example
export const createSubscription = async (userId: string, priceId: string) => {
  const user = await db.select().from(users).where(eq(users.id, userId));
  
  const subscription = await stripe.subscriptions.create({
    customer: user.stripeCustomerId,
    items: [{ price: priceId }],
    metadata: { userId }
  });
  
  return subscription;
};
```

### Pipeline Processing Updates
**Trigger:** When updating AI processing logic, status transitions, or pipeline stages
**Command:** `/update-pipeline`

1. **Update Pipeline Logic**: Modify `server/pipeline.ts` with new processing steps
2. **Handle Status Changes**: Update status management in routers
3. **Update Client Displays**: Modify status visualization components
4. **Add Pipeline Tests**: Test new pipeline stages and transitions
5. **Update Status UI**: Ensure `StatusTimeline` component reflects changes

```typescript
// Pipeline stage example
export const processPipelineStage = async (letterId: string, stage: PipelineStage) => {
  await updateLetterStatus(letterId, stage.status);
  
  const result = await stage.processor(letterId);
  
  if (result.success) {
    await moveToNextStage(letterId);
  } else {
    await handleProcessingError(letterId, result.error);
  }
  
  return result;
};
```

## Testing Patterns

- **Framework**: vitest for fast, TypeScript-native testing
- **File Pattern**: `*.test.ts` in `server/` directory
- **Style**: Comprehensive unit and integration tests
- **Coverage**: Include test counts in checkpoint commits
- **Database Testing**: Use test database with proper cleanup

```typescript
// Testing pattern example
import { describe, it, expect, beforeEach } from 'vitest';

describe('User Management', () => {
  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  it('should create user with valid data', async () => {
    const userData = { email: 'test@example.com', name: 'Test User' };
    const user = await createUser(userData);
    
    expect(user.id).toBeTruthy();
    expect(user.email).toBe(userData.email);
  });
});
```

## Commands

| Command | Purpose |
|---------|---------|
| `/new-feature` | Develop major new features across full stack |
| `/add-table` | Add new database tables and schema changes |
| `/checkpoint` | Create milestone commits with comprehensive status |
| `/new-email-template` | Add new transactional email templates |
| `/update-ui` | Enhance client-side pages and components |
| `/add-tests` | Expand test coverage for new functionality |
| `/update-payments` | Modify Stripe payment and billing features |
| `/update-pipeline` | Change AI processing pipeline and status flow |
```