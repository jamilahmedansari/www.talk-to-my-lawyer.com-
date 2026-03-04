---
name: codex2-talk-to-my-lawyer
description: Comprehensive AI assistant instructions for Talk to My Lawyer platform. Covers 3-stage AI pipeline (Perplexity research → Anthropic draft → Anthropic assembly), review workflow, payment processing, database operations, frontend patterns, and all coding conventions. Optimized for AI code generation assistants.
---

# Codex 2 Instructions — Talk to My Lawyer Platform

> **Platform:** AI-powered legal letter generation with attorney review
> **Stack:** React 19 + Vite + TypeScript + tRPC + Drizzle ORM + Supabase + Stripe
> **Architecture:** Full-stack monorepo with shared types

> **⚠️ Schema Changes:** All schema changes must be applied via Drizzle migrations. Follow the `drizzle/migrations/000X_description.sql` naming convention.

## Quick Context Summary

Talk to My Lawyer is a legal technology platform that:
1. Collects intake forms from subscribers
2. Runs a 3-stage AI pipeline (research → draft → assembly)
3. Charges subscribers to unlock for attorney review
4. Attorneys review, edit, approve/reject
5. PDF generated and sent to subscriber on approval

**Key User Roles:**
- `subscriber` — Submits letters, pays for service
- `employee` — Accesses review center (attorneys)
- `admin` — Full system access

## Mandatory Code Patterns

### 1. File Naming Convention
```typescript
// ✅ ALWAYS use camelCase for non-component files
letters.ts, intake-normalizer.ts, pdfGenerator.ts, stripeWebhook.ts

// ✅ Use PascalCase for React component files
SubmitLetter.tsx, ReviewModal.tsx, LetterPaywall.tsx

// ✅ Test files
phase85.test.ts, letters.test.ts, pdfGenerator.test.ts
```

### 2. Import Style (REQUIRED)
```typescript
// ✅ MANDATORY — Use alias imports, not relative paths
import { something } from '@/shared/types'
import { db } from '@/server/db'
import { MyComponent } from '@/components/MyComponent'

// ❌ FORBIDDEN — Deep relative imports
import { something } from '../../../shared/types'
```

### 3. Type Safety (CRITICAL)
```typescript
// ❌ NEVER use 'as any' without justification
const data = unsafe as any

// ✅ ALWAYS use proper type guards
function isLetterRequest(val: unknown): val is LetterRequest {
  return typeof val === 'object' && val !== null && 'id' in val
}

// ✅ ALWAYS use Zod for runtime validation at API boundaries
import { z } from 'zod'
const inputSchema = z.object({
  letterId: z.number(),
  content: z.string().min(50)
})
const validated = inputSchema.parse(rawInput)
```

### 4. Database Queries (DRIZZLE ONLY)
```typescript
// ✅ ALWAYS use Drizzle ORM
import { letterRequests } from '@/drizzle/schema'
import { eq, and, desc } from 'drizzle-orm'

const letters = await db
  .select()
  .from(letterRequests)
  .where(eq(letterRequests.userId, userId))
  .orderBy(desc(letterRequests.createdAt))

// ❌ NEVER write raw SQL
```

### 5. tRPC Procedure Template
```typescript2
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { subscriberProcedure } from '@/server/routers/_guards'
import { getLetterRequestById } from '@/server/db'

export const lettersRouter = router({
  // ✅ Standard pattern: input validation → auth check → logic → return
  myAction: subscriberProcedure
    .input(z.object({
      letterId: z.number(),
      content: z.string().min(50)
    }))
    .mutation(async ({ input, ctx }) => {
      // ctx.user is typed and authenticated
      const letter = await getLetterRequestById(input.letterId)

      // Verify ownership
      if (!letter || letter.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Perform action
      await updateLetter(input.letterId, input.content)

      return { success: true }
    })
})
```

### 6. Role Guards (MANDATORY)
```typescript
import {
  publicProcedure,      // No auth
  protectedProcedure,   // Any authenticated user
  subscriberProcedure,  // Subscriber only
  attorneyProcedure,    // Attorney + Admin
  adminProcedure        // Admin only
} from '@/server/routers/_guards'

// Use appropriate guard for each procedure
export const myRouter = router({
  publicAction: publicProcedure.query(() => { /* ... */ }),
  subscriberAction: subscriberProcedure.mutation(() => { /* ... */ }),
  attorneyAction: attorneyProcedure.mutation(() => { /* ... */ }),
  adminAction: adminProcedure.mutation(() => { /* ... */ })
})
```

## Letter Generation Pipeline Rules

### 3-Stage Pipeline Flow
```
STAGE 1: Perplexity sonar-pro (90s timeout)
  Purpose: Web-grounded legal research with citations
  Input: Normalized intake
  Output: ResearchPacket JSON (statutes, cases, local ordinances, SOL, defenses)

STAGE 2: Claude claude-opus-4-5 (120s timeout)
  Purpose: Generate initial legal draft
  Input: Intake + ResearchPacket
  Output: DraftOutput JSON (draftLetter, attorneyReviewSummary, openQuestions, riskFlags)

STAGE 3: Claude claude-opus-4-5 (120s timeout)
  Purpose: Polish and finalize letter
  Input: Intake + ResearchPacket + DraftOutput
  Output: Final letter text (min 200 chars, proper salutation/closing)
```

### Status Machine (FOLLOW EXACTLY)
``` 
submitted ──→ researching ──→ drafting ──→ generated_locked
                                  │
                                  └──────────────→ generated_unlocked
                                                        │
                                                        ├─→ pending_review
                                                        └─→ upsell_dismissed
generated_locked ─────────────────────────────────────→ pending_review
pending_review ──→ under_review ──→ approved | rejected | needs_changes
needs_changes ──→ researching | drafting
```

**Valid transitions** (defined in `shared/types.ts`):
```typescript
const ALLOWED_TRANSITIONS = {
  submitted: ['researching'],
  researching: ['drafting'],
  drafting: ['generated_locked', 'generated_unlocked'],
  generated_locked: ['pending_review'],
  generated_unlocked: ['pending_review', 'upsell_dismissed'],
  upsell_dismissed: [],
  pending_review: ['under_review'],
  under_review: ['approved', 'rejected', 'needs_changes'],
  needs_changes: ['researching', 'drafting']
}
```

### Pipeline Implementation Pattern
```typescript
// File: server/pipeline.ts

// ✅ Each stage follows this pattern:
export async function run[Stage]Stage(letterId: number, ...args: any): Promise<OutputType> {
  // 1. Create workflow job record
  const job = await createWorkflowJob({ letterRequestId: letterId, jobType: '...', provider: '...' })
  const jobId = (job as any)?.insertId ?? 0

  // 2. Update job status to running
  await updateWorkflowJob(jobId, { status: 'running', startedAt: new Date() })

  // 3. Update letter status
  await updateLetterStatus(letterId, '...')

  try {
    // 4. Build prompts
    const systemPrompt = build[Stage]SystemPrompt()
    const userPrompt = build[Stage]UserPrompt(...args)

    // 5. Call AI with timeout
    const { text } = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 8000,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS)
    })

    // 6. Validate output
    const validation = validate[Stage]Output(text)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`)
    }

    // 7. Store result
    await updateWorkflowJob(jobId, { status: 'completed', completedAt: new Date() })

    return validation.data
  } catch (err) {
    // 8. Handle failure
    const msg = err instanceof Error ? err.message : String(err)
    await updateWorkflowJob(jobId, { status: 'failed', errorMessage: msg, completedAt: new Date() })
    await updateLetterStatus(letterId, 'submitted') // Revert for retry
    throw err
  }
}
```

## Review Workflow Rules

### 5 Core Review Operations (MEMORIZE)
```typescript
// 1. CLAIM — Assign letter to attorney
review.claim({ letterId: number })
  Transition: pending_review → under_review
  Effects: Assign to attorney, log action, notify subscriber

// 2. SAVE EDIT — Save attorney edit version
review.saveEdit({ letterId, content, note? })
  Transition: None (stays under_review)
  Effects: Create attorney_edit version, log action

// 3. APPROVE — Final approval + PDF generation
review.approve({ letterId, finalContent, internalNote?, userVisibleNote? })
  Transition: under_review → approved
  Effects: Create final_approved version, generate PDF, upload to S3, notify subscriber

// 4. REJECT — Reject letter
review.reject({ letterId, reason, userVisibleReason? })
  Transition: under_review → rejected
  Effects: Log rejection, notify subscriber

// 5. REQUEST CHANGES — Ask subscriber for more info
review.requestChanges({ letterId, internalNote?, userVisibleNote, retriggerPipeline? })
  Transition: under_review → needs_changes
  Effects: Log request, notify subscriber, optionally re-trigger AI
```

### Email Notification Pattern (FIRE-AND-FORGET)
```typescript
// ✅ ALWAYS use fire-and-forget for non-blocking emails
sendEmail(to, data).catch(err => console.error('[Email] Failed:', err))

// ✅ NEVER await email sends in critical path
// ❌ BAD — Blocks response
await sendEmail(to, data) // Don't do this

// ✅ GOOD — Non-blocking
sendEmail(to, data).catch(err => console.error('[Email] Failed:', err))
return { success: true }
```

## Payment Processing Rules

### Payment Flow
```typescript
// FREE UNLOCK (first letter only)
billing.freeUnlock({ letterId })
  Conditions: User has 0 previously unlocked letters
  Transition: generated_locked OR generated_unlocked → pending_review

// PAY-PER-LETTER ($200)
billing.payToUnlock({ letterId, discountCode? })
  Creates Stripe checkout session
  Webhook: checkout.session.completed → pending_review
  Optionally: Process discount code, create commission

// ATTORNEY REVIEW UPSELL (free-trial letters only, $100)
billing.createAttorneyReviewCheckout({ letterId })
  Requires letter status generated_unlocked
  Webhook: checkout.session.completed → pending_review

// SUBSCRIPTION BYPASS
billing.checkPaywallStatus()
  Returns: { state: 'free' | 'subscribed' | 'pay_per_letter' }
  Active subscribers bypass paywall entirely
```

### Stripe Webhook Pattern
```typescript
// File: server/stripeWebhook.ts

export async function handleStripeWebhook(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const event = stripe.webhooks.constructEvent(await req.text(), sig, WEBHOOK_SECRET)

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object
      const letterId = parseInt(session.metadata.letterId)

      // Transition status
      await updateLetterStatus(letterId, 'pending_review')

      // Process discount
      if (session.metadata.discountCode) {
        await processDiscount(session.metadata.discountCode, session.amount_total)
      }

      // Send email
      await sendLetterUnlockedEmail(subscriberEmail, letterId)
      break
  }
}
```

## Frontend Development Rules

### Page Organization (MANDATORY)
```typescript
client/src/pages/
  ├── public/          // No auth required
  │   ├── Home.tsx
  │   ├── Pricing.tsx
  │   ├── Login.tsx
  │   └── Signup.tsx
  ├── subscriber/      // subscriberProcedure
  │   ├── Dashboard.tsx
  │   ├── SubmitLetter.tsx
  │   ├── MyLetters.tsx
  │   ├── LetterDetail.tsx
  │   └── Billing.tsx
  ├── attorney/        // attorneyProcedure
  │   ├── Dashboard.tsx
  │   ├── ReviewQueue.tsx
  │   └── ReviewDetail.tsx
  ├── employee/        // employeeProcedure
  │   ├── Dashboard.tsx
  │   ├── Referrals.tsx
  │   └── Earnings.tsx
  └── admin/           // adminProcedure
      ├── Dashboard.tsx
      ├── AllLetters.tsx
      ├── Users.tsx
      └── Jobs.tsx
```

### Route Protection Pattern
```typescript
import { ProtectedRoute } from '@/components/ProtectedRoute'

// ✅ ALWAYS protect routes by role
<Route path="/attorney/queue" element={
  <ProtectedRoute allowedRoles={['attorney', 'admin']}>
    <ReviewQueue />
  </ProtectedRoute>
} />

// ✅ Public routes need no wrapper
<Route path="/pricing" element={<Pricing />} />
```

### tRPC Query Pattern
```typescript
import { trpc } from '@/lib/trpc'

// ✅ Queries
const { data: letters, isLoading, error } = trpc.letters.myLetters.useQuery()

// ✅ Mutations with invalidation
const utils = trpc.useContext()
const submitLetter = trpc.letters.submit.useMutation({
  onSuccess: () => {
    utils.letters.myLetters.invalidate()
    utils.letters.canSubmit.invalidate()
  }
})

// ✅ Polling for real-time updates
const { data: letter } = trpc.letters.detail.useQuery(
  { id: letterId },
  {
    refetchInterval: (data) => {
      // Poll while in progress, stop when complete
      return ['researching', 'drafting', 'pending_review', 'under_review'].includes(data?.status)
        ? 2000
        : false
    }
  }
)
```

## Testing Requirements

### Test Organization
```typescript
// ✅ Phase-based test files
server/phase85.test.ts  // Tests for Phase 85 features
server/letters.test.ts  // Tests for letter operations

// ✅ Test structure
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/server/db'

describe('Phase 85: Feature Name', () => {
  beforeEach(async () => {
    // Setup: clean database, seed test data
  })

  it('should do the thing correctly', async () => {
    const result = await doTheThing(input)
    expect(result).toMatchObject({ success: true })
  })

  it('should handle errors gracefully', async () => {
    await expect(doTheThing(badInput)).rejects.toThrow('Expected error')
  })
})
```

## Error Handling Rules

### tRPC Errors
```typescript
import { TRPCError } from '@trpc/server'

// ✅ Use appropriate error codes
throw new TRPCError({ code: 'NOT_FOUND', message: 'Letter not found' })
throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' })
throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Must be logged in' })
throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' })
```

### Frontend Error Boundaries
```typescript
// ✅ Wrap pages with error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <MyPage />
</ErrorBoundary>

// ✅ Show errors to users
const { error } = trpc.letters.detail.useQuery()
if (error) {
  return <ErrorMessage message={error.message} />
}
```

## Database Schema Reference

### Core Tables (MEMORIZE)
```typescript
// users — User accounts
{ id, email, name, role, emailVerified, isActive, createdAt }

// letter_requests — Letter submissions
{ id, userId, letterType, subject, issueSummary, jurisdictionCountry,
  jurisdictionState, jurisdictionCity, intakeJson, status, priority,
  currentAiDraftVersionId, currentFinalVersionId, assignedReviewerId,
  pdfUrl, archivedAt, lastStatusChangedAt, createdAt, updatedAt }

// letter_versions — Draft versions
{ id, letterRequestId, versionType, content, createdByType,
  createdByUserId, metadataJson, createdAt }
// versionType: 'ai_draft' | 'attorney_edit' | 'final_approved'

// workflow_jobs — Pipeline execution tracking
{ id, letterRequestId, jobType, status, provider, inputPayload,
  outputPayload, errorMessage, startedAt, completedAt, createdAt }
// jobType: 'research' | 'draft_generation' | 'assembly'
// status: 'queued' | 'running' | 'completed' | 'failed'

// review_actions — Audit trail
{ id, letterRequestId, reviewerId, actorType, action, noteText,
  noteVisibility, fromStatus, toStatus, createdAt }
// noteVisibility: 'internal' | 'user_visible'

// research_runs — Research packet storage
{ id, letterRequestId, workflowJobId, provider, status, resultJson,
  validationResultJson, errorMessage, createdAt }

// attachments — Uploaded files
{ id, letterRequestId, uploadedByUserId, storagePath, fileName,
  mimeType, sizeBytes, metadataJson, createdAt }

// notifications — In-app notifications
{ id, userId, type, title, body, link, readAt, metadataJson, createdAt }

// subscriptions — Stripe subscriptions
{ id, userId, stripeSubscriptionId, stripeCustomerId, status,
  planId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt }
```

## Security Rules (CRITICAL)

### 1. Data Access Control
```typescript
// ✅ Subscribers can ONLY see their own letters
async function getLetterForSubscriber(letterId: number, userId: number) {
  const letter = await getLetterRequestById(letterId)
  if (letter.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return letter
}

// ✅ Subscribers NEVER see ai_draft until generated_locked
// ✅ Subscribers NEVER see internal review notes (noteVisibility: 'internal')
// ✅ Subscribers NEVER see attorney_edit versions, only final_approved
```

### 2. Email Verification
```typescript
// ✅ Check email verification before protected actions
if (!ctx.user.emailVerified) {
  await sendVerificationEmail(ctx.user.email)
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Please verify your email first'
  })
}
```

### 3. Rate Limiting
```typescript
// ✅ Rate limit expensive operations
await checkTrpcRateLimit('letter', `user:${ctx.user.id}`)
```

## Environment Variables (REQUIRED)

### Must Check Before Use
```typescript
// ✅ ALWAYS check for required env vars
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey || apiKey.trim().length === 0) {
  throw new Error('[Pipeline] ANTHROPIC_API_KEY is not set')
}
```

### Required Variables
```
ANTHROPIC_API_KEY         — Claude API (stages 2 & 3)
PERPLEXITY_API_KEY        — Research API (stage 1)
STRIPE_SECRET_KEY         — Stripe payments
STRIPE_WEBHOOK_SECRET     — Webhook verification
SUPABASE_DATABASE_URL     — Database connection
RESEND_API_KEY            — Email service
UPSTASH_REDIS_REST_URL    — Rate limiting
```

## Commit Message Format

```
[prefix]: [detailed description]

- [specific change 1]
- [specific change 2]
- [test status: XXX/XXX tests passing]
- [typescript check: 0 TypeScript errors]

Prefixes:
  feat:    New feature
  fix:     Bug fix
  refactor: Code restructuring
  docs:    Documentation changes
  test:    Test changes
  chore:   Maintenance tasks

Phase checkpoints:
  Checkpoint: Phase X: [description]
  - [changes]
  - XXX/XXX tests passing
  - 0 TypeScript errors
```

## When You Don't Know Something

1. **Check reference docs:**
   - `docs/skills/letter-generation-pipeline/SKILL.md`
   - `docs/skills/letter-review-pipeline/SKILL.md`
   - `ARCHITECTURE.md` — Full system overview
   - `SPEC_COMPLIANCE.md` — Feature status

2. **Check existing code patterns:**
   - Similar procedures in `server/routers/`
   - Similar tests in `server/*.test.ts`
   - Similar components in `client/src/pages/`

3. **Prioritize:**
   - Type safety (no `as any`)
   - Proper error handling
   - Security (ownership checks, role guards)
   - Test coverage

## Quick Reference Tables

| What You Need | Where to Find It |
|---------------|------------------|
| Pipeline orchestrator | `server/pipeline.ts` |
| Intake normalization | `server/intake-normalizer.ts` |
| Letter procedures | `server/routers/letters.ts` |
| Review procedures | `server/routers/review.ts` |
| Billing procedures | `server/routers/billing.ts` |
| DB helpers | `server/db.ts` |
| Email templates | `server/email.ts` |
| PDF generation | `server/pdfGenerator.ts` |
| Type definitions | `shared/types.ts` |
| Status constants | `shared/const.ts` |
| Database schema | `drizzle/schema.ts` |
| Auth guards | `server/routers/_guards.ts` |
| Frontend routing | `client/src/App.tsx` |
| Route protection | `client/src/components/ProtectedRoute.tsx` |
