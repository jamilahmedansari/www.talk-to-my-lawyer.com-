# Talk to My Lawyer — Architecture & Codebase Guide

This document maps the codebase to the canonical architecture defined in the **letter-generation-pipeline** and **letter-review-pipeline** skills (see `docs/skills/`).

## Quick Navigation

- **Letter Generation Pipeline** → `server/pipeline.ts` + `server/routers.ts` (letters.submit)
- **Letter Review Pipeline** → `server/routers.ts` (review.*, billing.*, admin.*)
- **Database** → `drizzle/schema.ts` + `server/db.ts`
- **Frontend** → `client/src/pages/` (organized by role)
- **Shared Types** → `shared/types.ts` + `shared/const.ts`

---

## Server Architecture

### Core Modules

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `server/routers.ts` | tRPC router definitions (all procedures) | 1,271 | ✅ Stable |
| `server/db.ts` | Database query helpers (CRUD, aggregations) | 932 | ✅ Stable |
| `server/pipeline.ts` | 3-stage AI orchestrator (research → draft → assembly) | 1,560 | ✅ Stable |
| `server/email.ts` | Email templates (8+ templates for all workflows) | 1,056 | ✅ Stable |
| `server/stripe.ts` | Stripe checkout + subscription management | 473 | ✅ Stable |
| `server/stripeWebhook.ts` | Stripe webhook handler (payment completion) | 380 | ✅ Stable |
| `server/pdfGenerator.ts` | PDF generation for approved letters (PDFKit) | 290 | ✅ Stable |
| `server/intake-normalizer.ts` | Canonical intake JSON normalization | 180 | ✅ Stable |
| `server/supabaseAuth.ts` | Supabase authentication integration | 210 | ✅ Stable |
| `server/rateLimiter.ts` | Rate limiting (Upstash Redis) | 85 | ✅ Stable |
| `server/cronScheduler.ts` | Scheduled tasks (draft reminders, cleanup) | 120 | ✅ Stable |
| `server/draftReminders.ts` | Email reminders for stuck drafts | 95 | ✅ Stable |
| `server/n8nCallback.ts` | n8n webhook handler (dormant) | 140 | ⚠️ Dormant |
| `server/sentry.ts` | Error tracking integration | 85 | ✅ Stable |
| `server/storage.ts` | S3 file upload helpers | 60 | ✅ Stable |

### Feature Modules (Logical Organization)

#### 1. **Letter Generation** (routers.ts: lines 169-395)

**tRPC Procedures:**
- `letters.submit` — Create letter request, trigger AI pipeline
- `letters.list` — Get subscriber's letters
- `letters.detail` — Get single letter with versions
- `letters.canSubmit` — Check subscription eligibility

**Key Functions (db.ts):**
- `createLetterRequest()` — Insert letter_request record
- `createAttachment()` — Store uploaded files
- `updateLetterStatus()` — Transition status
- `getLetterRequestById()` — Fetch letter with all related data

**Pipeline Flow:**
```
letters.submit
  → createLetterRequest() [status: submitted]
  → runLetterPipeline() async
    → Stage 1: Research (Perplexity)
    → Stage 2: Draft (Claude)
    → Stage 3: Assembly (Claude)
  → updateLetterStatus() [status: generated_locked]
  → sendLetterReadyEmail()
```

**See Also:** `docs/skills/letter-generation-pipeline/`

---

#### 2. **Letter Review** (routers.ts: lines 396-627)

**tRPC Procedures:**
- `review.queue` — Get pending letters (attorney view)
- `review.letterDetail` — Get letter with intake, research, draft
- `review.claim` — Assign letter to attorney
- `review.saveEdit` — Save attorney edits
- `review.approve` — Approve and generate PDF
- `review.reject` — Reject letter
- `review.requestChanges` — Request changes + optional re-trigger

**Key Functions (db.ts):**
- `claimLetterForReview()` — Assign to attorney, transition to under_review
- `logReviewAction()` — Audit trail
- `generateAndUploadApprovedPdf()` — PDF generation + S3 upload
- `updateLetterPdfUrl()` — Store PDF URL

**Review Flow:**
```
pending_review (after payment)
  → review.claim() → under_review
  → review.saveEdit() (multiple times)
  → review.approve() → approved
    → generateAndUploadApprovedPdf()
    → sendLetterApprovedEmail()
  OR review.reject() → rejected
  OR review.requestChanges() → needs_changes
```

**See Also:** `docs/skills/letter-review-pipeline/`

---

#### 3. **Authentication & Authorization** (routers.ts: lines 129-168)

**tRPC Procedures:**
- `auth.me` — Get current user
- `auth.logout` — Clear session
- `auth.completeOnboarding` — Set role + jurisdiction

**Role-Based Access Control (RBAC):**
- `publicProcedure` — No auth required
- `protectedProcedure` — Auth required (any role)
- `subscriberProcedure` — Subscriber only
- `attorneyProcedure` — Attorney or admin
- `adminProcedure` — Admin only

**Implementation:** `server/routers.ts` (lines 102-120)

**Frontend Guards:** `client/src/components/ProtectedRoute.tsx`

---

#### 4. **Billing & Payments** (routers.ts: lines 780-1011)

**tRPC Procedures:**
- `billing.createCheckout` — Stripe checkout for subscription
- `billing.createBillingPortal` — Stripe customer portal
- `billing.payToUnlock` — Pay-per-letter checkout ($200)
- `billing.payTrialReview` — Trial review checkout ($50)
- `billing.freeUnlock` — First letter free (no payment)
- `billing.checkCanSubmit` — Check subscription eligibility
- `billing.getSubscription` — Get current subscription
- `billing.getDiscountCode` — Validate discount code

**Stripe Webhook Handler:** `server/stripeWebhook.ts`
- Listens for: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`
- Transitions letter status on payment success
- Creates subscription records

**Pricing Model:**
- Free trial: 1 free letter (first letter only)
- Pay-per-letter: $200 one-time
- Monthly Basic: $499/month (4 letters)
- Monthly Pro: $699/month (8 letters)

**See Also:** `docs/skills/letter-review-pipeline/references/payment-flow.md`

---

#### 5. **Admin Controls** (routers.ts: lines 628-743)

**tRPC Procedures:**
- `admin.stats` — Dashboard statistics
- `admin.allLetters` — List all letters (with filters)
- `admin.getLetterDetail` — Full audit view
- `admin.users` — List all users
- `admin.assignLetter` — Assign letter to attorney
- `admin.forceStatusTransition` — Override status
- `admin.retryJob` — Re-trigger pipeline from stage
- `admin.jobs` — List workflow jobs

**Key Functions (db.ts):**
- `getSystemStats()` — Dashboard stats (total, by status, approved)
- `getAllLetters()` — Paginated letter list
- `retryPipelineFromStage()` — Re-run pipeline

---

#### 6. **Notifications & Messaging** (routers.ts: lines 744-756)

**tRPC Procedures:**
- `notifications.list` — Get user's notifications
- `notifications.markRead` — Mark notification as read

**Email Templates (email.ts):**
- `sendLetterReadyEmail()` — Letter generation complete
- `sendLetterUnlockedEmail()` — Payment successful
- `sendLetterUnderReviewEmail()` — Attorney claimed letter
- `sendLetterApprovedEmail()` — Letter approved + PDF
- `sendLetterRejectedEmail()` — Letter rejected
- `sendNeedsChangesEmail()` — Changes requested
- `sendDraftReminderEmail()` — Stuck draft reminder
- `sendEmployeeCommissionEmail()` — Commission earned

---

#### 7. **Affiliate & Commissions** (routers.ts: lines 1012-1153)

**tRPC Procedures:**
- `affiliate.getStats` — Referral stats
- `affiliate.getEarnings` — Commission earnings
- `affiliate.getDiscountCode` — Employee's discount code
- `affiliate.claimCommission` — Claim earned commission

**Commission Model:**
- Employees earn 15% on referred subscriptions
- Tracked via `commission_ledger` table
- Payouts via Stripe

---

#### 8. **Profile & User Management** (routers.ts: lines 1154-1271)

**tRPC Procedures:**
- `profile.update` — Update user profile
- `profile.getMe` — Get current user details
- `profile.verifyEmail` — Trigger email verification

---

### Database Schema

**File:** `drizzle/schema.ts`

**Core Tables:**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts | id, email, role, email_verified |
| `letter_requests` | Letter submissions | id, userId, status, subject, intakeJson |
| `letter_versions` | Letter drafts (AI + attorney edits) | id, letterId, type, content, stage |
| `workflow_jobs` | Pipeline execution tracking | id, letterId, stage, status, error |
| `research_runs` | Research packet storage | id, letterId, researchJson |
| `attachments` | Uploaded files | id, letterId, s3Key, fileName |
| `review_actions` | Audit trail | id, letterId, action, noteText, visibility |
| `subscriptions` | Stripe subscriptions | id, userId, stripeSubscriptionId, status |
| `notifications` | In-app notifications | id, userId, type, message |
| `commission_ledger` | Employee commissions | id, employeeId, amount, stripePaymentIntentId |
| `discount_codes` | Referral discount codes | id, code, employeeId, discountPercent |

**Status Enum:**
```typescript
submitted → researching → drafting → generated_locked
                                           ↓ (payment)
                                    pending_review
                                           ↓ (claim)
                                    under_review
                                    ↙    ↓    ↘
                            approved  rejected  needs_changes
```

---

## Client Architecture

### Directory Structure

```
client/src/
├── pages/
│   ├── public/
│   │   ├── Home.tsx              # Landing page
│   │   ├── Pricing.tsx           # Pricing page
│   │   ├── Login.tsx             # Login form
│   │   ├── Signup.tsx            # Signup form
│   │   └── ForgotPassword.tsx    # Password reset
│   ├── subscriber/
│   │   ├── Dashboard.tsx         # Subscriber home
│   │   ├── SubmitLetter.tsx      # Intake form
│   │   ├── MyLetters.tsx         # Letter list
│   │   ├── LetterDetail.tsx      # Letter view + paywall
│   │   ├── Billing.tsx           # Subscription management
│   │   ├── Profile.tsx           # User profile
│   │   └── Receipts.tsx          # Payment history
│   ├── attorney/
│   │   ├── Dashboard.tsx         # Attorney home (stats)
│   │   ├── ReviewQueue.tsx       # Letters to review
│   │   └── ReviewDetail.tsx      # Full review interface
│   ├── employee/
│   │   ├── Dashboard.tsx         # Employee home (referrals)
│   │   ├── Referrals.tsx         # Referral links
│   │   └── Earnings.tsx          # Commission history
│   └── admin/
│       ├── Dashboard.tsx         # Admin stats
│       ├── AllLetters.tsx        # All letters (filter)
│       ├── LetterDetail.tsx      # Audit view
│       ├── Users.tsx             # User management
│       └── Jobs.tsx              # Pipeline jobs
├── components/
│   ├── shared/
│   │   ├── AppLayout.tsx         # Main layout + sidebar
│   │   ├── ReviewModal.tsx       # Review interface
│   │   ├── RichTextEditor.tsx    # Attorney editor
│   │   ├── StatusBadge.tsx       # Status display
│   │   └── StatusTimeline.tsx    # Status history
│   ├── LetterPaywall.tsx         # Payment prompt
│   ├── PipelineProgressModal.tsx # Generation progress
│   ├── ProtectedRoute.tsx        # Role-based routing
│   ├── ErrorBoundary.tsx         # Error handling
│   └── ui/                       # Radix UI components
├── hooks/
│   ├── useAuth.ts                # Auth state
│   ├── useLetterRealtime.ts      # Supabase realtime
│   └── useTrpc.ts                # tRPC client
├── lib/
│   ├── trpc.ts                   # tRPC client setup
│   ├── supabase.ts               # Supabase client
│   └── utils.ts                  # Utilities
└── App.tsx                       # Main router (Wouter)
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Role-based route guarding |
| `AppLayout` | Sidebar + main content layout |
| `ReviewModal` | Attorney review interface (inline editor) |
| `LetterPaywall` | Payment prompt for locked letters |
| `PipelineProgressModal` | Real-time generation progress |
| `RichTextEditor` | Attorney edits (Tiptap) |
| `StatusTimeline` | Visual status history |

### Routing (Wouter)

**File:** `client/src/App.tsx`

```
/                           → Home (public)
/pricing                    → Pricing (public)
/login                      → Login (public)
/signup                     → Signup (public)
/forgot-password            → Password reset (public)

/subscriber                 → Dashboard (subscriber)
/submit                     → Intake form (subscriber)
/letters                    → My letters (subscriber)
/letters/:id                → Letter detail (subscriber)
/subscriber/billing         → Billing (subscriber)
/subscriber/profile         → Profile (subscriber)

/attorney                   → Dashboard (attorney)
/attorney/queue             → Review queue (attorney)
/attorney/:id               → Review detail (attorney)

/employee                   → Dashboard (employee)
/employee/referrals         → Referral links (employee)
/employee/earnings          → Earnings (employee)

/admin                      → Dashboard (admin)
/admin/letters              → All letters (admin)
/admin/letters/:id          → Letter audit (admin)
/admin/users                → User management (admin)
/admin/jobs                 → Pipeline jobs (admin)
```

---

## Shared Code

### Types

**File:** `shared/types.ts`

**Key Types:**
- `User` — User account
- `LetterRequest` — Letter submission
- `LetterVersion` — Draft/approved version
- `IntakeJson` — Intake form data
- `ResearchPacket` — Research output
- `DraftOutput` — Draft output
- `ReviewAction` — Audit trail entry
- `Subscription` — Stripe subscription

**Status Enums:**
- `LetterStatus` — 10 states (submitted, researching, drafting, generated_locked, pending_review, under_review, approved, rejected, needs_changes)
- `ReviewActionType` — Action types (claimed, approved, rejected, etc.)

### Constants

**File:** `shared/const.ts`

- `PLANS` — Pricing plans (free_trial, per_letter, monthly_basic, monthly_pro)
- `LETTER_TYPES` — Available letter types
- `ALLOWED_TRANSITIONS` — Valid status transitions

### Pricing

**File:** `shared/pricing.ts`

- `LETTER_UNLOCK_PRICE_CENTS` — $200 (20000)
- `MONTHLY_BASIC_PRICE_CENTS` — $499 (49900)
- `MONTHLY_PRO_PRICE_CENTS` — $699 (69900)

---

## Environment Variables

**Required:**
- `ANTHROPIC_API_KEY` — Claude API key
- `PERPLEXITY_API_KEY` — Perplexity Sonar API key
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret
- `SUPABASE_DATABASE_URL` — PostgreSQL connection
- `RESEND_API_KEY` — Email service
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Rate limiting

**Optional:**
- `N8N_WEBHOOK_URL` — n8n fallback (dormant)
- `SENTRY_DSN` — Error tracking
- `APP_BASE_URL` — Production domain

---

## Data Flow Examples

### Example 1: Submit Letter → Generate → Review

```
1. Subscriber fills intake form
   → client/src/pages/subscriber/SubmitLetter.tsx
   → calls letters.submit tRPC

2. Server creates letter_request (status: submitted)
   → server/routers.ts: letters.submit
   → server/db.ts: createLetterRequest()

3. Pipeline runs asynchronously
   → server/pipeline.ts: runLetterPipeline()
   → Stage 1: Research (Perplexity)
   → Stage 2: Draft (Claude)
   → Stage 3: Assembly (Claude)

4. Letter reaches generated_locked
   → server/email.ts: sendLetterReadyEmail()
   → client shows paywall

5. Subscriber pays $200
   → client/src/components/LetterPaywall.tsx
   → calls billing.payToUnlock tRPC
   → Stripe checkout

6. Stripe webhook fires
   → server/stripeWebhook.ts: checkout.session.completed
   → Updates status to pending_review

7. Attorney reviews letter
   → client/src/pages/attorney/ReviewDetail.tsx
   → calls review.claim, review.approve, etc.
   → PDF generated and sent
```

### Example 2: Subscription Management

```
1. Subscriber chooses plan
   → client/src/pages/subscriber/Billing.tsx
   → calls billing.createCheckout tRPC

2. Server creates Stripe checkout session
   → server/stripe.ts: createSubscriptionCheckout()
   → Returns checkout URL

3. Subscriber completes payment
   → Stripe webhook fires

4. Server creates subscription record
   → server/stripeWebhook.ts: customer.subscription.created
   → server/db.ts: createSubscription()

5. Subscriber can now submit letters
   → billing.checkCanSubmit validates plan
```

---

## Testing

**Unit Tests:** `vitest` (run via `pnpm test`)

**Integration Tests:** Manual testing via dev server

**E2E Tests:** None (manual testing recommended)

---

## Deployment

**Build:** `pnpm build`
- Vite builds React frontend → `dist/public/`
- esbuild bundles Express backend → `dist/index.js`

**Start:** `pnpm start`
- Runs `dist/index.js` (Node.js server)
- Serves frontend from `dist/public/`

**Environment:** Production env vars must be set before start

---

## Future Refactoring

See `REFACTOR_ROADMAP.md` for planned improvements.

---

## Related Documentation

- **Letter Generation Pipeline:** `docs/skills/letter-generation-pipeline/SKILL.md`
- **Letter Review Pipeline:** `docs/skills/letter-review-pipeline/SKILL.md`
- **Database Schema:** `drizzle/schema.ts` (with inline comments)
- **API Reference:** tRPC procedures in `server/routers.ts`
