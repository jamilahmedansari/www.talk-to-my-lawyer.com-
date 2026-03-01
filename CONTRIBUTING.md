# Contributing to Talk to My Lawyer

This guide explains how to contribute to the codebase, including code style, testing, and deployment.

---

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm (package manager)
- Supabase account (for database)
- Stripe account (for payments)

### Local Setup

```bash
# Clone the repository
gh repo clone jamilahmedansari/manus-talk-to-my-lawyer
cd manus-talk-to-my-lawyer

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
pnpm dev

# In another terminal, start the database
# (Supabase handles this automatically)
```

### Verify Setup
```bash
# Check TypeScript
pnpm check

# Run tests
pnpm test

# Build
pnpm build
```

---

## Code Style

### TypeScript

**General Rules:**
- Use strict mode (tsconfig.json: `strict: true`)
- Avoid `any` type — use `unknown` and narrow
- Use type inference where possible
- Add JSDoc comments to exported functions

**Example:**
```typescript
/**
 * Creates a new letter request and triggers the AI pipeline.
 * 
 * @param userId - The subscriber's user ID
 * @param intakeJson - Normalized intake form data
 * @returns The created letter request ID
 * @throws {TRPCError} If subscription is invalid
 */
export async function createLetterRequest(
  userId: number,
  intakeJson: IntakeJson,
): Promise<number> {
  // Implementation
}
```

### React Components

**Naming:**
- Components: PascalCase (e.g., `LetterDetail.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useLetterRealtime.ts`)
- Props interfaces: `${ComponentName}Props`

**Structure:**
```typescript
interface LetterDetailProps {
  letterId: number;
  onClose?: () => void;
}

export function LetterDetail({ letterId, onClose }: LetterDetailProps) {
  // Implementation
}
```

### File Organization

**Server:**
- Feature-based: `server/features/{feature}/`
- Utilities: `server/lib/`
- Core: `server/_core/`

**Client:**
- Pages: `client/src/pages/{role}/`
- Components: `client/src/components/`
- Hooks: `client/src/hooks/`

---

## Adding a New Feature

### Step 1: Design

1. Write a feature spec (what, why, how)
2. Design database schema changes (if needed)
3. Design API procedures (tRPC)
4. Design UI components

### Step 2: Backend

1. Update database schema in `drizzle/schema.ts`
2. Create migration: `pnpm db:push`
3. Add tRPC procedures in `server/routers.ts` (or feature module)
4. Add database helpers in `server/db.ts`
5. Add email templates if needed
6. Add tests

### Step 3: Frontend

1. Create pages/components in `client/src/`
2. Add tRPC hooks
3. Add error handling
4. Add loading states
5. Test in browser

### Step 4: Testing

1. Run `pnpm test` (unit tests)
2. Test manually in dev server
3. Test with different roles (subscriber, attorney, admin)
4. Test error cases

### Step 5: Documentation

1. Update `ARCHITECTURE.md` if structure changed
2. Add JSDoc comments
3. Update `README.md` if user-facing

### Step 6: Commit

```bash
git checkout -b feature/my-feature
git add .
git commit -m "feat: add my feature

- Added tRPC procedures
- Updated database schema
- Added UI components
- Added tests"
git push origin feature/my-feature
# Create pull request
```

---

## Working with the Pipeline

### Understanding the 3-Stage Pipeline

The letter generation pipeline has three stages:

1. **Research** (Perplexity sonar-pro) — Legal research with citations
2. **Drafting** (Claude claude-opus-4-5) — Initial draft from research
3. **Assembly** (Claude claude-opus-4-5) — Final polished letter

See `docs/skills/letter-generation-pipeline/` for details.

### Testing the Pipeline

```bash
# Run pipeline test
pnpm test

# Or manually trigger via admin panel
# Admin → All Letters → Letter #X → Trigger Full Pipeline
```

### Debugging Pipeline Failures

1. Check `workflow_jobs` table for error details
2. Check Sentry for error logs
3. Check email logs (Resend)
4. Retry via admin panel: **Trigger Full Pipeline** button

---

## Working with Payments (Stripe)

### Test Cards

Use these cards for testing in Stripe test mode:

| Card | Purpose |
|------|---------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Requires authentication |

### Testing Webhook

```bash
# Use Stripe CLI to forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# In another terminal, trigger test event
stripe trigger payment_intent.succeeded
```

### Payment Flow

1. Subscriber chooses plan → `billing.createCheckout`
2. Stripe checkout page
3. Payment completed → Stripe webhook
4. Webhook handler updates subscription
5. Subscriber can submit letters

---

## Database Migrations

### Creating a Migration

```bash
# Edit drizzle/schema.ts
# Then run:
pnpm db:push

# This generates migration files automatically
```

### Applying Migrations

```bash
# In production (via Manus WebDev)
# Migrations are applied automatically on deploy

# In development
pnpm db:push
```

### Reverting a Migration

```bash
# Drizzle doesn't support automatic rollback
# Manual steps:
# 1. Revert schema.ts to previous version
# 2. Create new migration with rollback SQL
# 3. Apply migration
```

---

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/db.test.ts

# Run with coverage
pnpm test --coverage
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('createLetterRequest', () => {
  it('should create a letter request', async () => {
    const result = await createLetterRequest(1, intakeJson);
    expect(result).toBeGreaterThan(0);
  });

  it('should throw if subscription is invalid', async () => {
    await expect(
      createLetterRequest(999, intakeJson)
    ).rejects.toThrow();
  });
});
```

### Integration Tests

Test full workflows:

```typescript
describe('Letter Generation Workflow', () => {
  it('should generate a letter end-to-end', async () => {
    // 1. Create subscriber
    // 2. Submit intake form
    // 3. Wait for pipeline
    // 4. Verify letter is generated
    // 5. Verify email was sent
  });
});
```

---

## Deployment

### Staging

```bash
# Push to main branch
git push origin main

# Manus WebDev automatically builds and deploys to staging
# Check status in Management UI
```

### Production

```bash
# Create a checkpoint
# (via Management UI or webdev_save_checkpoint)

# Click Publish button in Management UI
# App is deployed to production
```

### Environment Variables

**Production env vars are set in Manus Management UI:**
- Settings → Secrets
- Add/edit variables there
- They're injected at deploy time

---

## Common Tasks

### Adding a New Email Template

1. Create function in `server/email.ts`:
```typescript
export async function sendMyNewEmail(params: {
  to: string;
  name: string;
  // ... other params
}) {
  return resend.emails.send({
    from: ENV.resendFromEmail,
    to: params.to,
    subject: 'My Subject',
    html: `<h1>Hello ${params.name}</h1>`,
  });
}
```

2. Call from appropriate place (e.g., after status transition)

3. Test by triggering the action manually

### Adding a New tRPC Procedure

1. Add to `server/routers.ts`:
```typescript
myFeature: router({
  myProcedure: protectedProcedure
    .input(z.object({ /* ... */ }))
    .query(async ({ ctx, input }) => {
      // Implementation
      return result;
    }),
}),
```

2. Call from client:
```typescript
const result = trpc.myFeature.myProcedure.useQuery({ /* ... */ });
```

### Adding a New Page

1. Create `client/src/pages/{role}/MyPage.tsx`
2. Add route in `client/src/App.tsx`
3. Add navigation link in `client/src/components/shared/AppLayout.tsx`
4. Test with correct role

---

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf dist node_modules
pnpm install
pnpm build
```

### TypeScript Errors

```bash
# Check for type errors
pnpm check

# Fix common issues
pnpm format  # Auto-format code
```

### Database Connection Issues

```bash
# Verify connection string in .env
echo $SUPABASE_DATABASE_URL

# Test connection
psql $SUPABASE_DATABASE_URL -c "SELECT 1"
```

### Stripe Webhook Not Firing

1. Check webhook endpoint in Stripe dashboard
2. Verify `STRIPE_WEBHOOK_SECRET` in .env
3. Check Stripe webhook logs for errors
4. Test with Stripe CLI: `stripe trigger payment_intent.succeeded`

---

## Code Review Checklist

Before submitting a pull request:

- [ ] Code follows style guide
- [ ] All tests pass (`pnpm test && pnpm build`)
- [ ] No TypeScript errors (`pnpm check`)
- [ ] Added JSDoc comments to exported functions
- [ ] Updated `ARCHITECTURE.md` if structure changed
- [ ] Tested with multiple roles (if applicable)
- [ ] Tested error cases
- [ ] No console.log statements (use Sentry for logging)
- [ ] No hardcoded values (use env vars or constants)

---

## Questions?

- Check `ARCHITECTURE.md` for codebase structure
- Check `docs/skills/` for pipeline details
- Check `README.md` for quick start
- Ask in team chat or create an issue

---

## License

MIT
