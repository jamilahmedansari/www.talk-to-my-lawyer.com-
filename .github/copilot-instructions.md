# GitHub Copilot Instructions — Talk to My Lawyer

> **Project:** Talk to My Lawyer — AI-powered legal letter generation platform
> **Tech Stack:** React 19 + Vite + TypeScript | Express + tRPC | PostgreSQL + Drizzle | Supabase Auth | Stripe

## Code Style & Conventions

### File Naming
- Use **camelCase** for all TypeScript files: `letters.ts`, `intake-normalizer.ts`, `pdfGenerator.ts`
- Test files: `*.test.ts` or `phase*.test.ts`
- Component files: `PascalCase.tsx` for React components
- Database migrations: `drizzle/####_description.sql`

### Import Style
```typescript
// ✅ PREFERRED — Use alias imports
import { something } from '@/shared/types'
import { db } from '@/server/db'
import { MyComponent } from '@/components/MyComponent'

// ❌ AVOID — Relative imports when alias available
import { something } from '../../../shared/types'
```

### Export Style
```typescript
// Both named and default exports are acceptable
export const namedFunction = () => {}
export default ComponentName
```

### Commit Messages
```bash
# Format: prefix: detailed description
# Include test counts and TypeScript check status

feat: add Stripe payment integration for letter unlock
- Implemented billing.payToUnlock procedure
- Added webhook handler for checkout.session.completed
- 320/320 tests passing
- 0 TypeScript errors

# Phase checkpoints:
Checkpoint: Phase 85: Sentry Alert Rules Configuration
- Implemented alert rules for pipeline failures
- 321/321 tests passing
- 0 TypeScript errors
```

## Type Safety Rules

```typescript
// ❌ AVOID — Unsafe casts
const data = someValue as any
const result = response as unknown as MyType

// ✅ PREFERRED — Type guards and validation
function isMyType(val: unknown): val is MyType {
  return typeof val === 'object' && val !== null && 'key' in val
}
if (isMyType(someValue)) { /* safe to use */ }

// Use Zod for runtime validation
const schema = z.object({ field: z.string() })
const validated = schema.parse(rawInput)
```

## Database Queries (Drizzle ORM)

```typescript
// ✅ PREFERRED — Use Drizzle ORM with proper types
import { letterRequests, users } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'

const letters = await db
  .select()
  .from(letterRequests)
  .where(eq(letterRequests.userId, userId))

// ❌ AVOID — Raw SQL queries
const result = await db.run(`SELECT * FROM letter_requests WHERE user_id = ?`, [userId])
```

## tRPC Procedures

```typescript
// ✅ Standard pattern with role guards and validation
import { z } from 'zod'
import { subscriberProcedure } from '@/server/routers/_guards'

export const myProcedure = subscriberProcedure
  .input(z.object({
    letterId: z.number(),
    content: z.string().min(50)
  }))
  .mutation(async ({ input, ctx }) => {
    // ctx.user is typed and verified
    const letter = await getLetterRequestById(input.letterId)

    // Verify ownership
    if (letter.userId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    return { success: true }
  })
```

## Role-Based Access Control

```typescript
// Use appropriate procedure guards:
import { publicProcedure, protectedProcedure, subscriberProcedure, attorneyProcedure, adminProcedure } from '@/server/routers/_guards'

// publicProcedure — No auth required (e.g., login, signup)
// protectedProcedure — Any authenticated user
// subscriberProcedure — Subscriber role only
// attorneyProcedure — Attorney or Admin roles
// adminProcedure — Admin role only
```

## Error Handling

```typescript
// ✅ Fire-and-forget for non-blocking operations
sendEmail(to, data).catch(err => console.error('[Email] Failed:', err))

// ✅ Explicit error visibility for user-facing operations
try {
  await uploadAttachment(file)
} catch (err) {
  setShowError(true)
  setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
}

// ✅ Use TRPCError for API errors
import { TRPCError } from '@trpc/server'
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Letter not found'
})
```

## Letter Generation Pipeline

The platform uses a **3-stage AI pipeline** for letter generation:

```
Stage 1: Perplexity (sonar-pro) → Legal Research (90s timeout)
  Input: IntakeJson → Output: ResearchPacket JSON

Stage 2: Anthropic Claude (claude-opus-4-5) → Initial Draft (120s timeout)
  Input: IntakeJson + ResearchPacket → Output: DraftOutput JSON

Stage 3: Anthropic Claude (claude-opus-4-5) → Final Assembly (120s timeout)
  Input: IntakeJson + ResearchPacket + DraftOutput → Output: Final Letter Text
```

### Status Machine

```
submitted → researching → drafting → generated_lock
                                            ↓ (payment)
                                     pending_review
                                            ↓ (claim)
                                     under_review
                                      ↙  ↓  ↘
                               approved rejected needs_changes
```

### Key Pipeline Files

- `server/pipeline.ts` — Orchestrator + prompt builders
- `server/intake-normalizer.ts` — Intake normalization
- `server/routers/letters.ts` — Submit procedure (triggers pipeline)

## Review Workflow

Attorneys review letters through these operations:

```typescript
// 1. Claim letter for review
review.claim({ letterId: number })
  → pending_review → under_review
  → Assigns to attorney, notifies subscriber

// 2. Save attorney edit (no status change)
review.saveEdit({ letterId, content, note? })
  → Creates attorney_edit version

// 3. Approve letter
review.approve({ letterId, finalContent, internalNote?, userVisibleNote? })
  → under_review → approved
  → Generates PDF, sends email

// 4. Reject letter
review.reject({ letterId, reason, userVisibleReason? })
  → under_review → rejected

// 5. Request changes
review.requestChanges({ letterId, internalNote?, userVisibleNote, retriggerPipeline? })
  → under_review → needs_changes
```

## Payment Processing

```typescript
// Free unlock (first letter only)
billing.freeUnlock({ letterId })
  → Check for prior unlocks
  → generated_locked → pending_review

// Pay-per-letter ($200)
billing.payToUnlock({ letterId, discountCode? })
  → Create Stripe checkout
  → Webhook handles completion

// Check paywall status
billing.checkPaywallStatus()
  → Returns: { state: 'free' | 'subscribed' | 'pay_per_letter' }
```

## Email Templates

```typescript
// All email functions in server/email.ts
import {
  sendLetterSubmissionEmail,
  sendLetterReadyEmail,
  sendLetterApprovedEmail,
  sendLetterRejectedEmail,
  sendNeedsChangesEmail
} from '@/server/email'

// Fire-and-forget pattern
sendEmail(to, data).catch(err => console.error('[Email] Failed:', err))
```

## Frontend Patterns

### Component Structure
```typescript
// ✅ Use role-based page organization
client/src/pages/
  ├── public/          (no auth required)
  ├── subscriber/      (subscriberProcedure)
  ├── attorney/        (attorneyProcedure)
  └── admin/           (adminProcedure)
```

### Route Guards
```typescript
// ✅ Use ProtectedRoute for role-based access
import { ProtectedRoute } from '@/components/ProtectedRoute'

<Route path="/attorney/queue" element={
  <ProtectedRoute allowedRoles={['attorney', 'admin']}>
    <ReviewQueue />
  </ProtectedRoute>
} />
```

### tRPC Hooks
```typescript
// ✅ Use tRPC hooks for data fetching
import { trpc } from '@/lib/trpc'

const { data: letters } = trpc.letters.myLetters.useQuery()
const mutateSubmit = trpc.letters.submit.useMutation()

// ✅ Use optimistic updates for better UX
const utils = trpc.useContext()
mutateSubmit.mutate(input, {
  onSuccess: () => {
    utils.letters.myLetters.invalidate()
  }
})
```

## Testing Patterns

```typescript
// ✅ Phase-based test organization
// server/phase85.test.ts

import { describe, it, expect } from 'vitest'

describe('Phase 85: Sentry Alert Rules', () => {
  it('should create alert on pipeline failure', async () => {
    const result = await handlePipelineFailure(letterId)
    expect(result.alertCreated).toBe(true)
  })
})
```

## Environment Variables

When creating code that needs environment variables:

```typescript
// ✅ Check for required environment variables
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey || apiKey.trim().length === 0) {
  throw new Error('ANTHROPIC_API_KEY is not set')
}
```

Required variables:
- `ANTHROPIC_API_KEY` — Claude API
- `PERPLEXITY_API_KEY` — Research API
- `STRIPE_SECRET_KEY` — Payments
- `SUPABASE_DATABASE_URL` — Database
- `RESEND_API_KEY` — Email

## Common Patterns

### Database Transaction
```typescript
import { db } from '@/server/db'

async function createLetterWithVersion(data: any) {
  const letter = await db.insert(letterRequests).values(data).returning()
  await db.insert(letterVersions).values({
    letterRequestId: letter.id,
    // ...
  })
  return letter
}
```

### Status Transition
```typescript
import { ALLOWED_TRANSITIONS } from '@/shared/types'

function canTransition(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

// Admin override available
await updateLetterStatus(letterId, newStatus) // No check for admin
```

### PDF Generation
```typescript
import { generateAndUploadApprovedPdf } from '@/server/pdfGenerator'

const { pdfUrl, pdfKey } = await generateAndUploadApprovedPdf({
  letterId, letterType, subject, content,
  approvedBy, approvedAt, jurisdictionState, jurisdictionCountry, intakeJson
})
```

## Security Best Practices

1. **Never expose AI drafts to subscribers** until payment complete
2. **Never show internal review notes** to subscribers
3. **Always verify email** before allowing protected actions
4. **Use role guards** on all protected procedures
5. **Validate input** with Zod schemas
6. **Sanitize user input** before using in prompts
7. **Never log sensitive data** (full intake, API keys)

## Active Issue Priorities

When working on this codebase, prioritize:

1. **Critical:** Remove `as any` casts, fix email verification, improve error visibility
2. **High:** Upload security, auth race handling, debouncing, error boundaries
3. **Medium:** Configurable assets, pagination, accessibility, optimistic updates

## Reference Documentation

- **Pipeline details:** `docs/skills/letter-generation-pipeline/SKILL.md`
- **Review workflow:** `docs/skills/letter-review-pipeline/SKILL.md`
- **Architecture:** `ARCHITECTURE.md`
- **Spec compliance:** `SPEC_COMPLIANCE.md`
