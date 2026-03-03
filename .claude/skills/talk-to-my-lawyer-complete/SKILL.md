---
name: talk-to-my-lawyer-complete
description: Complete reference for Talk to My Lawyer legal technology platform. Covers the 3-stage AI letter generation pipeline (Perplexity research → Anthropic draft → Anthropic assembly), attorney review workflow, payment processing, database schema, code conventions, and testing patterns. Use this when building, debugging, or extending any part of the platform.
---

# Talk to My Lawyer — Complete Development Reference

This skill provides comprehensive knowledge of the Talk to My Lawyer platform, a TypeScript/Vite-based legal technology application that converts subscriber intake forms into attorney-reviewed legal letters through a multi-stage AI pipeline.

## Platform Overview

**Tech Stack:**
- Frontend: React 19 + Vite + TypeScript
- Backend: Express + tRPC + TypeScript
- Database: PostgreSQL via Supabase with Drizzle ORM
- Auth: Supabase Auth
- Payments: Stripe
- Storage: Supabase Storage (S3-compatible)
- Email: Resend
- AI: Perplexity (research) + Anthropic Claude (drafting/assembly)
- Monitoring: Sentry
- Rate Limiting: Upstash Redis

**User Roles:**
- `subscriber` — Submits letter requests, pays for review
- `employee` — Accesses review center (attorneys)
- `admin` — Full system access

## Project Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (React + Vite)                    │
│  client/src/pages/{public,subscriber,attorney,admin}/       │
└──────────────────────────┬──────────────────────────────────┘
                           │ tRPC
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Server (Express + tRPC)                    │
│  server/routers/{letters,review,billing,admin,auth}/       │
│  server/{pipeline,email,db,pdfGenerator,stripe}/           │
└──────────────────────────┬──────────────────────────────────┘
                           │ Drizzle ORM
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (PostgreSQL + Supabase)                │
│  Tables: users, letter_requests, letter_versions,           │
│          workflow_jobs, research_runs, review_actions,      │
│          attachments, notifications, subscriptions           │
└─────────────────────────────────────────────────────────────┘
```

## Letter Generation Pipeline

### Pipeline Stages

```
Subscriber submits intake form
        │
        ▼
  [letters.submit] → creates letter_request (status: submitted)
        │
        ▼
  ┌─────────────────────────────────────────┐
  │  Stage 1: RESEARCH (Perplexity sonar-pro) │
  │  Status: submitted → researching          │
  │  Timeout: 90s                             │
  │  Output: ResearchPacket JSON              │
  └─────────────────┬───────────────────────┘
                    ▼
  ┌─────────────────────────────────────────┐
  │  Stage 2: DRAFTING (Claude claude-opus-4-5)  │
  │  Status: researching → drafting           │
  │  Timeout: 120s                            │
  │  Output: DraftOutput JSON                 │
  └─────────────────┬───────────────────────┘
                    ▼
  ┌─────────────────────────────────────────┐
  │  Stage 3: ASSEMBLY (Claude claude-opus-4-5)  │
  │  Status: drafting → generated_locked      │
  │  Timeout: 120s                            │
  │  Output: Final letter text                │
  └─────────────────┬───────────────────────┘
                    ▼
  Letter version created (type: ai_draft)
  Email sent to subscriber ("Your letter is ready")
  Subscriber sees paywall → pays → pending_review
```

### Key Files

| File | Purpose |
|------|---------|
| `server/pipeline.ts` | 3-stage orchestrator + prompt builders |
| `server/intake-normalizer.ts` | Canonical intake normalization |
| `server/routers/letters.ts` | Submit procedure, triggers pipeline |
| `server/db.ts` | Letter CRUD helpers |

### Status Machine

```
submitted ──→ researching ──→ drafting ──→ generated_locked
    ▲                                           │
    │                                    (payment unlock)
    │                                           ▼
    │                                    pending_review
    │                                           │
    │                                    (attorney claims)
    │                                           ▼
    │                                    under_review
    │                                     ╱    │    ╲
    │                              approved rejected needs_changes
    │                                                    │
    └────────────────────────────────────────────────────┘
                    (re-trigger from researching or drafting)
```

Allowed transitions defined in `shared/types.ts` → `ALLOWED_TRANSITIONS`.

### Data Shapes

**IntakeJson** (raw form submission):
```typescript
{
  schemaVersion: string;
  letterType: string;
  sender: { name, address, email?, phone? };
  recipient: { name, address, email?, phone? };
  jurisdiction: { country, state, city? };
  matter: { category, subject, description, incidentDate? };
  financials?: { amountOwed?, currency? };
  desiredOutcome: string;
  tonePreference?: "firm" | "moderate" | "aggressive";
  additionalContext?: string;
  // ... more fields
}
```

**ResearchPacket** (Stage 1 output):
```typescript
{
  researchSummary: string;
  jurisdictionProfile: { country, stateProvince, city?, authorityHierarchy };
  issuesIdentified: string[];
  applicableRules: Array<{ruleTitle, ruleType, jurisdiction, citationText, summary, sourceUrl, confidence}>;
  localJurisdictionElements: Array<{element, whyItMatters, sourceUrl, confidence}>;
  factualDataNeeded: string[];
  openQuestions: string[];
  riskFlags: string[];
  draftingConstraints: string[];
}
```

**DraftOutput** (Stage 2 output):
```typescript
{
  draftLetter: string;
  attorneyReviewSummary: string;
  openQuestions: string[];
  riskFlags: string[];
}
```

### Prompt Strategies

**Stage 1 (Research):**
- Instructs AI to find REAL, CURRENT, VERIFIABLE legal information
- Requires specific jurisdiction research (city → state → federal)
- Demands real court decisions with docket numbers
- Requires exact statute citations with section numbers
- Asks for political/enforcement context
- Returns structured ResearchPacket JSON

**Stage 2 (Drafting):**
- Uses full intake + ResearchPacket
- Instructs proper legal letter structure
- Incorporates research citations
- Matches requested tone (firm/moderate/aggressive)
- Flags open questions and risk areas
- Returns structured DraftOutput JSON

**Stage 3 (Assembly):**
- Polishes draft into final form
- Ensures proper legal letter format
- Adds standard disclaimers
- Validates output (min 200 chars, proper salutation/closing)

## Letter Review Pipeline

### Review Flow

```
generated_locked (AI draft complete)
        │
        ▼
  [Payment Unlock]
  │  First letter free → billing.freeUnlock
  │  Pay-per-letter ($200) → Stripe checkout → webhook
  │  Subscription → bypasses paywall
        │
        ▼
  pending_review
  │  Letter appears in Attorney Review Queue
  │  Email sent to attorney team
        │
        ▼
  [Attorney Claims Letter]
  │  review.claim → assigns reviewer
  │  Status: pending_review → under_review
  │  Subscriber notified
        │
        ▼
  under_review
  │  Attorney sees: intake, attachments, AI draft, research
  │  Attorney can: edit inline, save edits, add notes
        │
        ▼
  [Attorney Decision]
  ├── APPROVE → approved (PDF generated, email sent)
  ├── REJECT → rejected (email sent)
  └── REQUEST CHANGES → needs_changes (can re-trigger AI)
```

### 5 Core Review Operations

| Operation | Procedure | Transition | Key Effects |
|-----------|-----------|------------|-------------|
| Claim | `review.claim` | pending_review → under_review | Assigns attorney, notifies subscriber |
| Save Edit | `review.saveEdit` | No change | Creates attorney_edit version |
| Approve | `review.approve` | under_review → approved | Creates final_approved, generates PDF, sends email |
| Reject | `review.reject` | under_review → rejected | Logs reason, sends email |
| Request Changes | `review.requestChanges` | under_review → needs_changes | Logs notes, can re-trigger AI |

### Key Files

| File | Purpose |
|------|---------|
| `server/routers/review.ts` | All review procedures |
| `server/pdfGenerator.ts` | PDFKit PDF generation |
| `server/email.ts` | Email notification templates |
| `server/stripeWebhook.ts` | Stripe payment webhook |

## Payment & Billing

### Pricing Model

| Plan | Price | Letters |
|------|-------|---------|
| Free Trial | $0 | 1 letter (first only) |
| Pay-Per-Letter | $200 | 1 letter |
| Trial Review | $50 | Attorney review only |
| Monthly Basic | $499/month | 4 letters |
| Monthly Pro | $699/month | 8 letters |

### Payment Flow

**Free Unlock:**
```typescript
billing.freeUnlock({ letterId })
  → Verify first letter (no prior unlocks)
  → Transition: generated_locked → pending_review
  → Log review action: free_unlock
  → Send emails
```

**Pay-Per-Letter:**
```typescript
billing.payToUnlock({ letterId, discountCode? })
  → Create Stripe checkout ($200 or discounted)
  → Redirect to Stripe
  → Webhook: checkout.session.completed
  → Transition: generated_locked → pending_review
```

**Subscription Bypass:**
```typescript
billing.checkPaywallStatus()
  → If active recurring subscription: return "subscribed"
  → Letter bypasses paywall entirely
```

## Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts | id, email, role, emailVerified |
| `letter_requests` | Letter submissions | id, userId, status, subject, intakeJson, currentAiDraftVersionId, currentFinalVersionId |
| `letter_versions` | Draft versions | id, letterRequestId, versionType (ai_draft/attorney_edit/final_approved), content |
| `workflow_jobs` | Pipeline tracking | id, letterRequestId, jobType, status, provider, errorMessage |
| `research_runs` | Research storage | id, letterRequestId, resultJson, validationResultJson |
| `review_actions` | Audit trail | id, letterRequestId, action, noteText, noteVisibility (internal/user_visible) |
| `attachments` | Uploaded files | id, letterRequestId, storagePath, fileName, mimeType |
| `notifications` | In-app notifications | id, userId, type, title, body, link |
| `subscriptions` | Stripe subscriptions | id, userId, stripeSubscriptionId, status |

### Required Indexes

All 7 required indexes are present:
- `idx_letter_requests_status`
- `idx_letter_requests_userId`
- `idx_letter_requests_assignedReviewerId`
- `idx_letter_versions_letterRequestId`
- `idx_review_actions_letterRequestId`
- `idx_workflow_jobs_letterRequestId_status`
- `idx_research_runs_letterRequestId_status`

## Code Conventions

### File Naming
- **Use camelCase** for all file names: `letters.ts`, `intake-normalizer.ts`, `pdfGenerator.ts`
- Test files: `*.test.ts` or `phase*.test.ts`
- Database migrations: `drizzle/####_description.sql`

### Import/Export Style
```typescript
// Use alias imports — preferred
import { something } from '@/shared/types'
import { db } from '@/server/db'

// Mixed export style is acceptable
export const namedFunction = () => {}
export default ComponentName
```

### Commit Messages
- **Average length:** ~271 characters (detailed, not brief)
- **Prefixes:** `feat:`, `fix:`, `refactor:`, `docs:`, `checkpoint:`
- **Phase commits:** `Checkpoint: Phase X: [description]`
- **Include test counts:** `XXX/XXX tests passing`
- **Include TypeScript check:** `0 TypeScript errors`

Example:
```
Checkpoint: Phase 85: Sentry Alert Rules Configuration

- Implemented alert rules for pipeline failures and payment errors
- Added tests covering alert creation and notification dispatch
- 320/320 tests passing
- 0 TypeScript errors
```

### Type Safety Rules
- **CRITICAL:** Avoid `as any` casts — use proper type guards
- **Role-based access:** Use typed procedures (`subscriberProcedure`, `attorneyProcedure`, `adminProcedure`)
- **Email verification:** Verify email before accessing protected routes
- **Database queries:** Use Drizzle ORM, never raw SQL

### Error Handling
- **Fire-and-forget for non-blocking:** Email sending, PDF generation
```typescript
sendEmail(...).catch(err => console.error("[Email] Failed:", err))
```
- **Explicit error visibility:** localStorage failures, upload failures, submission failures
- **SPA-safe navigation:** Avoid full-page redirects, use router navigation
- **Production-safe logging:** Use Sentry for error tracking

## Workflows

### Phase Checkpoint Commit
**Trigger:** When finishing a major feature phase

1. Implement feature changes across multiple files
2. Add comprehensive test coverage in `server/phase*.test.ts`
3. Run tests: `pnpm test` — verify all pass
4. Check TypeScript: `tsc --noEmit` — verify 0 errors
5. Create checkpoint commit with descriptive message
6. Update `todo.md` with progress

### Database Schema Migration
**Trigger:** When adding new database fields or tables

1. Update `drizzle/schema.ts` with new schema
2. Generate migration SQL: `drizzle/####_description.sql`
3. Update migration metadata: `drizzle/meta/*.json`
4. Update `drizzle/meta/_journal.json`
5. Apply migration to Supabase
6. Update `server/db.ts` with new query functions
7. Add tests for new queries

### Email Template Integration
**Trigger:** When adding new email notifications

1. Add template function to `server/email.ts`:
```typescript
export const sendNewNotificationEmail = async (
  to: string,
  data: { name: string; details: string }
) => {
  // Implementation
};
```
2. Wire into tRPC procedure (fire-and-forget):
```typescript
sendNewNotificationEmail(input.email, result).catch(console.error);
```
3. Add tests in `server/phase*.test.ts`
4. Update `todo.md`

### tRPC Procedure Addition
**Trigger:** When adding new API endpoints

1. Add procedure definition with Zod validation:
```typescript
newProcedure: publicProcedure
  .input(z.object({ field: z.string() }))
  .query(async ({ input, ctx }) => {
    return await getSomeData(input.field);
  })
```
2. Implement database queries in `server/db.ts`
3. Add comprehensive tests
4. Wire frontend calls using tRPC hooks
5. Ensure role-based access control

## Testing Patterns

- **Test organization:** Phase-based (`server/phase*.test.ts`)
- **Comprehensive coverage:** Every feature needs tests
- **Test counts:** Document passing tests in commits (XXX/XXX)
- **TypeScript validation:** Always confirm 0 errors before commit
- **Test areas:** tRPC procedures, database operations, email functionality

## Frontend Architecture

### Directory Structure
```
client/src/
├── pages/
│   ├── public/          (Home, Pricing, Login, Signup)
│   ├── subscriber/      (Dashboard, SubmitLetter, MyLetters, LetterDetail, Billing)
│   ├── attorney/        (Dashboard, ReviewQueue, ReviewDetail)
│   ├── employee/        (Dashboard, Referrals, Earnings)
│   └── admin/           (Dashboard, AllLetters, LetterDetail, Users, Jobs)
├── components/
│   ├── shared/          (AppLayout, StatusBadge, StatusTimeline)
│   ├── LetterPaywall.tsx
│   ├── PipelineProgressModal.tsx
│   └── ProtectedRoute.tsx
├── hooks/               (useAuth, useLetterRealtime, useTrpc)
└── App.tsx              (Wouter routing)
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Role-based route guarding |
| `LetterPaywall` | Payment prompt for locked letters |
| `PipelineProgressModal` | Real-time generation progress |
| `StatusTimeline` | Visual status history |
| `ReviewModal` | Attorney review interface |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Stages 2 + 3 (Claude) |
| `PERPLEXITY_API_KEY` | Recommended | Stage 1 research |
| `STRIPE_SECRET_KEY` | Yes | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook verification |
| `SUPABASE_DATABASE_URL` | Yes | Database connection |
| `RESEND_API_KEY` | Yes | Email service |
| `UPSTASH_REDIS_REST_URL` | Yes | Rate limiting |
| `N8N_WEBHOOK_URL` | No | n8n fallback (dormant) |
| `SENTRY_DSN` | No | Error tracking |
| `APP_BASE_URL` | No | Production domain |

## Active Issue Register

Before starting any work, prioritize these known issues:

**Critical (Fix First):**
- Remove unsafe `as any` usage
- Fix email verification typing/logic
- Improve localStorage failure handling
- Replace SPA-breaking redirects with router navigation
- Surface upload/submission failures to users

**High:**
- File upload security hardening
- Auth race-condition mitigation
- localStorage write frequency/debounce
- Theme context hydration handling
- Suspense error boundaries
- Polling/realtime coordination

**Medium/Low:**
- Configurable logo/assets
- Pagination coverage
- Accessibility gaps
- Optimistic updates
- Production-safe logging
- Shared status enums
- Form-state architecture cleanup

## Key Source Files Reference

### Pipeline Files
- `server/pipeline.ts` — 3-stage AI orchestrator (1560 lines)
- `server/intake-normalizer.ts` — Canonical intake normalization
- `server/n8nCallback.ts` — n8n webhook handler (dormant)

### Router Files
- `server/routers/letters.ts` — Letter submission and management
- `server/routers/review.ts` — Attorney review operations
- `server/routers/billing.ts` — Payment and subscription
- `server/routers/admin.ts` — Admin controls
- `server/routers/auth.ts` — Authentication

### Utility Files
- `server/db.ts` — Database query helpers (932 lines)
- `server/email.ts` — Email templates (1056 lines)
- `server/stripe.ts` — Stripe checkout (473 lines)
- `server/stripeWebhook.ts` — Stripe webhook (380 lines)
- `server/pdfGenerator.ts` — PDF generation (290 lines)

### Frontend Files
- `client/src/App.tsx` — Main router
- `client/src/components/ProtectedRoute.tsx` — Route guards
- `client/src/components/LetterPaywall.tsx` — Payment UI

### Documentation Files
- `docs/skills/letter-generation-pipeline/SKILL.md` — Pipeline details
- `docs/skills/letter-review-pipeline/SKILL.md` — Review workflow
- `ARCHITECTURE.md` — Full architecture guide
- `SPEC_COMPLIANCE.md` — Spec compliance status

## Usage Tips

**When building new features:**
1. Check `SPEC_COMPLIANCE.md` for remaining gaps
2. Follow code conventions (camelCase files, alias imports)
3. Add comprehensive tests (phase*.test.ts)
4. Use typed procedures with role guards
5. Include detailed commit messages with test counts
6. Update `todo.md` with progress

**When debugging:**
1. Check `workflow_jobs` table for pipeline errors
2. Check `research_runs` for validation failures
3. Review Sentry for production errors
4. Use `admin.retryJob` to re-trigger failed stages

**When extending the pipeline:**
1. Read `docs/skills/letter-generation-pipeline/SKILL.md`
2. Update prompt builders in `server/pipeline.ts`
3. Add validators for new output shapes
4. Update `shared/types.ts` with new types
5. Test with real letter submissions

**When extending review workflow:**
1. Read `docs/skills/letter-review-pipeline/SKILL.md`
2. Add procedures in `server/routers/review.ts`
3. Log review actions for audit trail
4. Send email notifications (fire-and-forget)
5. Update attorney UI in `client/src/pages/attorney/`
