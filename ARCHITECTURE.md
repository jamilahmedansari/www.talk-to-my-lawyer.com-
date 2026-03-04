# Talk to My Lawyer — Architecture & Codebase Guide

> **Last Updated:** 2026-03-04
> **Single TODO Source:** See [PROJECT_TODO.md](PROJECT_TODO.md)

## Quick Navigation

- **Letter Generation Pipeline** → `server/pipeline.ts` + `server/routers/letters.ts`
- **Letter Review Pipeline** → `server/routers/review.ts`
- **Billing & Payments** → `server/routers/billing.ts` + `server/stripe.ts` + `server/stripeWebhook.ts`
- **Admin Controls** → `server/routers/admin.ts`
- **Database** → `drizzle/schema.ts` + `server/db.ts`
- **Frontend** → `client/src/pages/` (organized by role)
- **Shared Types** → `shared/types.ts` + `shared/const.ts`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| API | tRPC v11 (Express adapter) |
| Database | PostgreSQL (Supabase) + Drizzle ORM |
| Auth | Supabase Auth (email/password) |
| Payments | Stripe (checkout, subscriptions, webhooks) |
| AI Pipeline | Perplexity (sonar-pro) + Anthropic Claude (claude-opus-4-5) |
| Email | Resend API |
| Storage | Supabase Storage (S3-compatible) |
| PDF | PDFKit (server-side) |
| Rate Limiting | Upstash Redis |
| Monitoring | Sentry |

---

## Role System (4 Roles)

| Role | DB Value | Access Scope | Dashboard Route |
|------|----------|-------------|----------------|
| Subscriber | `subscriber` | Own letters, billing, profile | `/dashboard` |
| Employee | `employee` | Affiliate dashboard, discount codes, commissions, payouts | `/employee` |
| Attorney | `attorney` | Review Center (queue + detail), SLA dashboard | `/attorney` |
| Admin | `admin` | Full platform access, user management, jobs, letters, affiliate oversight | `/admin` |

**RBAC Guards:**
- `subscriberProcedure` — Subscriber role only
- `attorneyProcedure` — Attorney, Employee, or Admin roles
- `employeeProcedure` — Employee or Admin roles
- `adminProcedure` — Admin role only
- `protectedProcedure` — Any authenticated user
- `publicProcedure` — No auth required

---

## Server Architecture

### Entry Point

`server/_core/index.ts` → Express app with:
- tRPC adapter at `/api/trpc`
- Stripe webhook at `/api/stripe-webhook`
- n8n callback at `/api/n8n-callback`
- Dev email preview at `/api/dev/email-preview` (non-production only)
- Static file serving for the React SPA

### Router Modules

| Router | File | Procedures | Guard |
|--------|------|-----------|-------|
| `auth` | `server/routers/auth.ts` | me, logout, completeOnboarding | public/protected |
| `letters` | `server/routers/letters.ts` | submit, myLetters, detail, updateForChanges, archive, uploadAttachment | subscriberProcedure |
| `review` | `server/routers/review.ts` | queue, letterDetail, claim, approve, reject, requestChanges, saveEdit, stats | attorneyProcedure |
| `admin` | `server/routers/admin.ts` | stats, users, updateRole, allLetters, failedJobs, retryJob, purgeFailedJobs, letterJobs, employees, getLetterDetail, forceStatusTransition, assignLetter | adminProcedure |
| `billing` | `server/routers/billing.ts` | getSubscription, checkCanSubmit, createCheckout, createBillingPortal, checkPaywallStatus, freeUnlock, payToUnlock, paymentHistory, receipts | mixed |
| `notifications` | `server/routers/notifications.ts` | list, markRead, markAllRead | protectedProcedure |
| `affiliate` | `server/routers/affiliate.ts` | myCode, myEarnings, myCommissions, requestPayout, myPayouts | employeeProcedure |
| `versions` | `server/routers/versions.ts` | get | protectedProcedure (role-scoped) |

### Key Server Files

| File | Purpose | Lines |
|------|---------|-------|
| `server/pipeline.ts` | 3-stage AI orchestrator + prompt builders | ~1560 |
| `server/intake-normalizer.ts` | Canonical intake normalization | ~120 |
| `server/db.ts` | All database query helpers | ~930 |
| `server/email.ts` | Email templates (9 templates) | ~1060 |
| `server/stripe.ts` | Stripe checkout + subscription helpers | ~470 |
| `server/stripeWebhook.ts` | Stripe webhook handler | ~380 |
| `server/pdfGenerator.ts` | PDFKit PDF generation | ~290 |
| `server/storage.ts` | Supabase Storage (S3) helpers | ~80 |
| `server/n8nCallback.ts` | n8n webhook handler (dormant) | ~260 |
| `server/sentry.ts` | Sentry error tracking | ~50 |
| `server/rateLimiter.ts` | Upstash Redis rate limiting | ~80 |

---

## Letter Generation Pipeline (3 Stages)

```
Stage 1: Perplexity (sonar-pro) → Legal Research (90s timeout)
  Input: IntakeJson → Output: ResearchPacket JSON
  Status: submitted → researching

Stage 2: Anthropic Claude (claude-opus-4-5) → Initial Draft (120s timeout)
  Input: IntakeJson + ResearchPacket → Output: DraftOutput JSON
  Status: researching → drafting

Stage 3: Anthropic Claude (claude-opus-4-5) → Final Assembly (120s timeout)
  Input: IntakeJson + ResearchPacket + DraftOutput → Output: Final letter text
  Status: drafting → generated_locked
```

On completion: creates `ai_draft` letter version, sends "letter ready" email to subscriber.
On failure: status reverts to `submitted`, error logged to `workflow_jobs`.

**See:** `docs/skills/letter-generation-pipeline/SKILL.md` for full specification.

---

## Status Machine

```
submitted → researching → drafting → generated_locked
                                          │
                                          ▼
                                    [Payment Unlock]
                                          │
                                          ▼
                                    pending_review → under_review → approved
                                                                 → rejected
                                                                 → needs_changes
                                                                       │
                                                                       ▼
                                                              researching | drafting
```

**Legacy statuses** (still in schema enum, deprecated):
- `generated_unlocked` — First-letter free path (deprecated in Phase 69)
- `upsell_dismissed` — Free copy kept (deprecated in Phase 69)

---

## Payment Flow

```
1. Pipeline completes → status = generated_locked
2. Subscriber sees paywall (blurred draft + $200 CTA)
3. Pay $200 → Stripe checkout → webhook → status = pending_review
4. OR: First letter free → billing.freeUnlock → status = pending_review
5. OR: Active subscription → bypasses paywall
```

**Stripe Products:**
- Per-letter: $29 (was $200, check current pricing in `server/stripe.ts`)
- Monthly: $79/mo
- Annual: $599/yr

---

## Review Workflow

```
pending_review → [Attorney claims] → under_review
under_review → [Approve] → approved (PDF generated, email sent)
under_review → [Reject] → rejected (email sent)
under_review → [Request Changes] → needs_changes (can re-trigger pipeline)
```

**5 Core Operations:**
1. `review.claim` — Assign letter to attorney
2. `review.saveEdit` — Save attorney edit version (no status change)
3. `review.approve` — Final approval + PDF generation + email
4. `review.reject` — Reject with reason
5. `review.requestChanges` — Request changes, optionally re-trigger AI

**See:** `docs/skills/letter-review-pipeline/SKILL.md` for full specification.

---

## Database Schema (13 tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (synced from Supabase Auth) |
| `letter_requests` | Letter intake + status tracking (22 columns) |
| `letter_versions` | Immutable version history (`ai_draft`, `attorney_edit`, `final_approved`) |
| `review_actions` | Audit trail for all review actions |
| `workflow_jobs` | Pipeline execution tracking |
| `research_runs` | Perplexity research results |
| `attachments` | File uploads (Supabase Storage references) |
| `notifications` | In-app notifications |
| `subscriptions` | Stripe subscription tracking |
| `discount_codes` | Employee referral codes |
| `commission_ledger` | Affiliate commission records |
| `payout_requests` | Employee payout requests |
| `payments` | Payment records |

**Schema file:** `drizzle/schema.ts`
**Migrations:** `drizzle/migrations/`

### Key Enums

| Enum | Values |
|------|--------|
| `user_role` | `subscriber`, `employee`, `attorney`, `admin` |
| `letter_status` | `submitted`, `researching`, `drafting`, `generated_locked`, `generated_unlocked`, `upsell_dismissed`, `pending_review`, `under_review`, `needs_changes`, `approved`, `rejected` |
| `version_type` | `ai_draft`, `attorney_edit`, `final_approved` |
| `actor_type` | `system`, `subscriber`, `employee`, `attorney`, `admin` |

---

## Client Architecture

### Directory Structure

```
client/src/
├── _core/              # Auth hooks, providers
├── pages/
│   ├── public/         # Login, Signup, ForgotPassword, ResetPassword, FAQ
│   ├── subscriber/     # Dashboard, SubmitLetter, MyLetters, LetterDetail, Billing, Receipts, Profile
│   ├── attorney/       # Dashboard
│   ├── employee/       # Dashboard, ReviewQueue, ReviewDetail, AffiliateDashboard
│   └── admin/          # Dashboard, AllLetters, LetterDetail, Users, Jobs, Affiliate
├── components/
│   ├── shared/         # AppLayout, StatusBadge, StatusTimeline, ProtectedRoute
│   ├── ui/             # shadcn/ui primitives
│   ├── LetterPaywall.tsx
│   ├── PipelineProgressModal.tsx
│   ├── ReviewModal.tsx
│   └── OnboardingModal.tsx
├── lib/
│   └── trpc.ts         # tRPC client setup
└── App.tsx             # Route definitions
```

### Route Structure

| Route | Page | Role |
|-------|------|------|
| `/dashboard` | SubscriberDashboard | subscriber |
| `/submit` | SubmitLetter | subscriber |
| `/letters` | MyLetters | subscriber |
| `/letters/:id` | LetterDetail | subscriber |
| `/subscriber/billing` | Billing | subscriber |
| `/subscriber/receipts` | Receipts | subscriber |
| `/profile` | Profile | any authenticated |
| `/attorney` | AttorneyDashboard | attorney, admin |
| `/attorney/queue` | ReviewQueue | attorney, employee, admin |
| `/attorney/:id` | ReviewDetail | attorney, employee, admin |
| `/employee` | EmployeeDashboard | employee |
| `/employee/affiliate` | AffiliateDashboard | employee |
| `/admin` | AdminDashboard | admin |
| `/admin/users` | Users | admin |
| `/admin/jobs` | Jobs | admin |
| `/admin/letters` | AllLetters | admin |
| `/admin/letters/:id` | AdminLetterDetail | admin |
| `/admin/affiliate` | AdminAffiliate | admin |

---

## Email Templates (9)

| Template | Trigger | Recipient |
|----------|---------|-----------|
| `sendLetterSubmissionEmail` | Letter submitted | Subscriber |
| `sendLetterReadyEmail` | Pipeline completes (`generated_locked`) | Subscriber |
| `sendLetterUnlockedEmail` | Payment confirmed | Subscriber |
| `sendLetterApprovedEmail` | Attorney approves | Subscriber |
| `sendLetterRejectedEmail` | Attorney rejects | Subscriber |
| `sendNeedsChangesEmail` | Attorney requests changes | Subscriber |
| `sendStatusUpdateEmail` | Generic status change | Subscriber |
| `sendNewReviewNeededEmail` | Letter reaches `pending_review` | Attorneys/Admins |
| `sendJobFailedAlertEmail` | Pipeline job fails | Admins |

---

## Employee Affiliate System

- Employees get a unique discount code on onboarding
- Discount codes give subscribers a percentage off per-letter pricing
- Commissions tracked in `commission_ledger` (5% of payment)
- Employees can request payouts
- Admin can approve/reject payouts
- Admin has full affiliate oversight (codes, commissions, payouts)

---

## Data Flow Examples

### Submit Letter → Generate → Review → Approve

```
1. Subscriber fills intake form → client/src/pages/subscriber/SubmitLetter.tsx
2. calls letters.submit tRPC → server/routers/letters.ts
3. Creates letter_request (status: submitted) → server/db.ts
4. Pipeline runs async → server/pipeline.ts
   → Stage 1: Research (Perplexity) → status: researching
   → Stage 2: Draft (Claude) → status: drafting
   → Stage 3: Assembly (Claude) → status: generated_locked
5. Email sent: "Your letter is ready" → server/email.ts
6. Subscriber sees paywall → client/src/components/LetterPaywall.tsx
7. Pays $29 → Stripe checkout → server/stripeWebhook.ts → status: pending_review
8. Attorney claims → review.claim → status: under_review
9. Attorney edits & approves → review.approve → status: approved
10. PDF generated → server/pdfGenerator.ts → uploaded to Supabase Storage
11. Email sent: "Your letter is approved" with PDF link
12. Subscriber downloads PDF from My Letters
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API (Stages 2 & 3) |
| `PERPLEXITY_API_KEY` | Research API (Stage 1) |
| `STRIPE_SECRET_KEY` | Stripe server-side |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `SUPABASE_DATABASE_URL` | PostgreSQL connection |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `RESEND_API_KEY` | Email (Resend) |
| `SENTRY_DSN` | Error monitoring |
| `UPSTASH_REDIS_REST_URL` | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `N8N_WEBHOOK_URL` | n8n webhook (dormant) |

---

## Security

1. **Never expose AI drafts to subscribers** until payment complete
2. **Never show internal review notes** to subscribers
3. **Always verify email** before allowing protected actions
4. **Use role guards** on all protected procedures
5. **Validate input** with Zod schemas
6. **Sanitize user input** before using in prompts
7. **Never log sensitive data** (full intake, API keys)
8. Row-Level Security (RLS) enabled on all tables in Supabase
