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
submitted → researching → drafting → generated_locked
                               ↘
                                generated_unlocked → pending_review | upsell_dismissed
generated_locked → pending_review → under_review → approved | rejected | needs_changes
needs_changes → researching | drafting
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

---

## Project TODO Tracker

> **Last Updated:** 2026-03-04
> **Purpose:** Shared TODO list across all coding agents (GitHub Copilot, Claude, Codex, etc.)
> **Usage:** Mark items as `[x]` when completed. All agents should continue from the last completed item.

### Phase 1: Foundation
- [x] Database schema (users roles, letter_requests, letter_versions, review_actions, workflow_jobs, research_runs, attachments, notifications)
- [x] Status machine enum and transition validation (submitted → researching → drafting → pending_review → under_review → approved/rejected/needs_changes, NO draft state)
- [x] Global design system (color palette, typography, theme)

### Phase 2: Auth & Navigation
- [x] Role-based user system (subscriber, employee, admin)
- [x] Role-based routing and navigation
- [x] DashboardLayout with sidebar for each role (AppLayout component)
- [x] Login/auth flow with role detection and auto-redirect

### Phase 3: Subscriber Portal
- [x] Multi-step letter intake form (jurisdiction, matter type, parties, facts, desired outcome)
- [x] File upload for attachments (S3 integration)
- [x] My Letters list page with status badges
- [x] Letter detail page (status timeline, intake summary, final approved letter only)
- [x] Secure data isolation — subscribers never see AI drafts or research

### Phase 4: Employee/Attorney Review Center
- [x] Review queue with filtering (pending_review, under_review, needs_changes)
- [x] Review detail page with intake panel, AI draft editor, research panel
- [x] Claim/assign letter for review
- [x] Save attorney edit version
- [x] Approve/reject/request changes actions
- [x] Review actions audit trail

### Phase 5: Admin Dashboard
- [x] Failed jobs monitor
- [x] Retry failed pipeline jobs
- [x] System health overview (queue counts, status distribution)
- [x] User management (role assignment)

### Phase 6: AI Pipeline
- [x] Stage 1: Perplexity API research (jurisdiction rules, statutes, case law)
- [x] Research packet validation gate
- [x] Stage 2: OpenAI drafting from validated research
- [x] Draft parser/validator
- [x] Pipeline orchestration (status transitions, job logging)
- [x] Failure handling and retry logic

### Phase 6b: High-Priority Additions
- [x] Deterministic research packet validator (validateResearchPacket)
- [x] Deterministic draft JSON parser/validator (parseAndValidateDraftLlmOutput)
- [x] Subscriber-safe detail endpoint (never returns ai_draft/attorney edits/internal research)
- [x] Notification system via Resend email (subscriber: needs_changes/approved/rejected; attorney/admin: pending_review/failed jobs)
- [x] Transactional email templates: status change, approval, rejection, needs_changes, new_review_needed
- [x] Resend API key configuration (via webdev_request_secrets)
- [x] Claim/assignment locking in attorney review queue
- [x] Retry failed job controls for admins
- [x] Idempotency protections for duplicate submissions/retries
- [x] Note visibility (internal vs user_visible) in review actions
- [x] Final approved version generation on approval (freeze version + current_final_version_id)
- [ ] PDF export / downloadable output for final letters (future enhancement)

### Phase 7: Testing & Delivery
- [x] Vitest unit tests for critical paths (29 tests passing)
- [x] End-to-end verification (TypeScript clean, server healthy)
- [ ] Save checkpoint and deliver

### Future Enhancements
- [ ] PDF export for final approved letters
- [ ] n8n workflow integration for letter generation
- [ ] Stripe payment integration for subscriptions
- [ ] Mobile PWA optimization

### Phase 8: E2E Workflow Audit & Fix
- [x] Audit intake form fields → pipeline input mapping
- [x] Add 3rd AI stage: Claude/Anthropic final letter assembly (combines research + draft into professional letter)
- [x] Ensure pipeline status transitions fire correctly: submitted → researching → drafting → pending_review
- [x] Ensure review center claim/approve/reject correctly updates status and creates final version
- [x] Ensure approved letter appears in subscriber My Letters with full content
- [x] Ensure subscriber detail page shows final approved letter (not AI drafts/research)

### Phase 9: Stripe Payment Integration
- [ ] Add Stripe feature via webdev_add_feature
- [ ] Subscription plans: per-letter ($299), monthly ($200/mo unlimited), annual ($2000/yr 48 letters)
- [ ] Checkout session creation with metadata
- [ ] Webhook handler for checkout.session.completed
- [ ] Atomic subscription activation (prevent race conditions)
- [ ] Commission tracking (5% employee referral)
- [ ] Employee coupon system (20% discount on per-letter)
- [ ] Pricing page UI
- [ ] Credit/letter allowance enforcement before letter submission

### Phase 10: Spec Compliance Patches (from pasted_content_4)
- [ ] Add buildNormalizedPromptInput helper (trim strings, safe defaults, filter empty rows)
- [ ] Strengthen validateResearchPacket: require sourceUrl+sourceTitle per rule, prefer >= 3 rules
- [ ] Add subscriber updateForChanges mutation (re-submit after needs_changes)
- [ ] Add admin forceStatusTransition mutation (audited)
- [x] Add frontend polling/revalidation for researching/drafting/pending_review statuses
- [ ] Add status timeline component in subscriber LetterDetail
- [ ] Add subscriber update form when status is needs_changes
- [ ] Verify success path E2E (submit → research → draft → assembly → pending_review → claim → approve → subscriber sees final)
- [ ] Verify failure path (invalid research stops pipeline, invalid draft stops pipeline)
- [ ] Verify security (subscriber cannot access ai_draft/research/internal notes)

### Phase 12: Stripe Payment Integration
- [x] Fix TypeScript error in AdminLetterDetail page
- [x] Add Stripe scaffold via webdev_add_feature
- [x] Configure STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY
- [x] Create subscriptions and payments tables in database
- [x] Create Stripe products/prices: per-letter ($29), monthly ($79/mo), annual ($599/yr)
- [x] Build checkout session endpoint (tRPC)
- [x] Build Stripe webhook handler (subscription events, payment events)
- [x] Build subscription status checker middleware
- [x] Build billing portal redirect endpoint
- [x] Build Pricing page with 3 plans
- [x] Build Subscription status component in subscriber dashboard
- [x] Gate letter submission behind active subscription or available credits
- [x] Show upgrade prompt when subscriber has no active plan
- [x] Admin: view subscriber subscription status
- [x] Run tests and save checkpoint (29/29 passing, 0 TS errors)

### Phase 11: n8n Workflow Integration & Frontend Polish
- [ ] Get n8n workflow webhook URL for the best legal letter workflow
- [ ] Activate the n8n workflow so webhook is live
- [ ] Update pipeline.ts to call n8n webhook as primary, with in-app AI fallback
- [ ] Add N8N_WEBHOOK_URL as environment variable
- [ ] Build admin letter detail page with force status transition dialog
- [ ] Add polling/revalidation to employee ReviewDetail for in-progress statuses
- [ ] Verify TypeScript compiles cleanly
- [ ] Run all tests

### Phase 13: Dashboard Enhancement — Letters History & Payment Receipts
- [ ] Audit current subscriber dashboard, MyLetters, and Billing pages
- [ ] Add backend: letters list with search/filter/sort/pagination (tRPC)
- [ ] Add backend: payment receipts list from Stripe invoices (tRPC)
- [ ] Rebuild MyLetters page as full Letters History with search, filter by status/type/date, sort, pagination
- [ ] Build Payment Receipts page with Stripe invoice history, amounts, dates, downloadable receipt links
- [ ] Enhance subscriber Dashboard with summary stats (total letters, active subscription, credits used, pending reviews)
- [ ] Add recent activity feed on dashboard (last 5 letters with status)
- [ ] Add quick action cards on dashboard (Submit Letter, View Letters, Billing)
- [ ] Run tests, verify, save checkpoint

### Phase 14: Paywall Flow Revision + Dashboard Enhancements
- [x] Add generated_locked status to schema enum and status machine
- [x] Update DB migration to include generated_locked status
- [x] Add payToUnlock mutation: create per-letter checkout, on success advance to pending_review
- [x] Build LetterPaywall component: blurred AI draft preview + Pay Now button
- [x] Update LetterDetail to show LetterPaywall when status = generated_locked
- [x] Update pipeline to set status = generated_locked after AI assembly (instead of pending_review)
- [x] Update Stripe webhook to handle letter unlock (generated_locked → pending_review)
- [x] Update MyLetters list: generated_locked highlighted amber with "Unlock for $29" badge
- [x] Update StatusTimeline: generated_locked step with amber lock icon
- [x] Update StatusBadge: generated_locked shows "Ready to Unlock" in yellow
- [x] Tests: 31/31 passing, 0 TypeScript errors
- [ ] Build Payment Receipts page with invoice history, amounts, dates, receipt links (future)
- [ ] Enhance subscriber Dashboard: subscription status widget, activity feed, quick action cards (future)
- [ ] Add date range filter to Letters History (future)

### Phase 15: Post-Submission Email Notifications
- [x] Add sendLetterSubmissionEmail: branded confirmation email sent immediately after letter submission
- [x] Add sendLetterReadyEmail: "your draft is ready" email sent when AI pipeline sets generated_locked
- [x] Add sendLetterUnlockedEmail: payment confirmation email sent after Stripe unlock webhook
- [x] Wire sendLetterSubmissionEmail into letters.submit mutation (routers.ts)
- [x] Wire sendLetterReadyEmail into pipeline.ts Stage 3 completion (in-app pipeline path)
- [x] Wire sendLetterReadyEmail into n8nCallback.ts completion (n8n pipeline path)
- [x] Wire sendLetterUnlockedEmail into stripeWebhook.ts letter unlock handler
- [x] Tests: 35/35 passing, 0 TypeScript errors

### Phase 16: Dev Email Preview Endpoint
- [x] Build server/emailPreview.ts: dev-only Express route at GET /api/dev/email-preview
- [x] Index page: lists all 9 templates with HTML and plain-text preview links
- [x] Per-template rendering: ?type=submission|letter_ready|unlocked|approved|rejected|needs_changes|new_review|job_failed|status_update
- [x] Query param support: ?name=&subject=&letterId=&state=&letterType=&mode= for realistic preview data
- [x] Guard: only active in NODE_ENV !== production (verified in tests)
- [x] Dev toolbar overlay showing template name and subject line in browser
- [x] Register route in server/_core/index.ts
- [x] Vitest tests: route export, dev registration, production guard (3 new tests)
- [x] Tests: 38/38 passing, 0 TypeScript errors

---

**Note:** This TODO list is synchronized across all documentation files. When completing items, update this section in all files to maintain consistency.
