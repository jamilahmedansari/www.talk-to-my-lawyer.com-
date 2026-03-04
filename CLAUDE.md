# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
pnpm dev          # Start dev server (tsx watch with hot reload)
pnpm build        # Build for production (Vite + esbuild)
pnpm start        # Run production build

# Code Quality
pnpm check        # TypeScript type check (must pass before commits)
pnpm test         # Run all tests with vitest
pnpm lint         # ESLint
pnpm format       # Prettier format

# Database
pnpm db:push      # Generate and push Drizzle migrations to database

# MCP Sync
pnpm mcp:sync     # Sync MCP configs (Supabase, Stripe)
```

**Important:** Always run `pnpm check` before committing — zero TypeScript errors required.

## Architecture Overview

### Monorepo Structure

```
server/           # Express + tRPC backend
├── _core/        # Core server setup (trpc, auth, rate limiting, sentry)
├── routers/      # tRPC procedure routers (letters, review, billing, admin, etc.)
├── pipeline.ts   # 3-stage AI letter generation orchestrator
├── db.ts         # Database query helpers (Drizzle ORM)
├── email.ts      # Email templates (Resend)
├── stripe.ts     # Stripe checkout and subscription helpers
├── stripeWebhook.ts  # Stripe webhook handler
└── pdfGenerator.ts   # PDF generation (PDFKit)

client/src/       # React 19 + Vite frontend
├── pages/        # Route components organized by role (public/, subscriber/, attorney/, employee/, admin/)
├── components/   # Shared components and shadcn/ui primitives
├── lib/trpc.ts   # tRPC client setup
└── App.tsx       # Route definitions (wouter)

drizzle/          # Database schema and migrations
shared/           # Shared TypeScript types and constants
├── pricing.ts    # SINGLE SOURCE OF TRUTH for all pricing
└── types.ts      # Shared type definitions
```

### 3-Stage AI Pipeline

The core value proposition — letter generation flows through three stages:

1. **Stage 1 (Perplexity sonar-pro)**: Legal research → `letter_requests.status = 'researching'`
2. **Stage 2 (Claude claude-opus-4-5)**: Initial draft → `status = 'drafting'`
3. **Stage 3 (Claude claude-opus-4-5)**: Final assembly → `status = 'generated_locked'`

**Implementation:** [server/pipeline.ts](server/pipeline.ts) (~1560 lines)
**Trigger:** [letters.submit](server/routers/letters.ts) tRPC procedure creates letter_request, then pipeline runs async

### Status Machine

```
submitted → researching → drafting → generated_locked
                                              ↓
                                    [Payment Unlock / Free Trial]
                                              ↓
                                    pending_review → under_review → approved
                                                                   → rejected
                                                                   → needs_changes
```

**Status enum:** See [drizzle/schema.ts](drizzle/schema.ts) or [shared/const.ts](shared/const.ts)
**Status source of truth:** Database enum in `drizzle/schema.ts`

## Role-Based Access Control (RBAC)

Four roles with hierarchical permissions:

| Role | Guard | Dashboard | Key Permissions |
|------|-------|-----------|------------------|
| `subscriber` | `subscriberProcedure` | `/dashboard` | Submit letters, view own letters, billing |
| `employee` | `employeeProcedure` | `/employee` | Affiliate dashboard, discount codes, commissions |
| `attorney` | `attorneyProcedure` | `/attorney` | Review queue, approve/reject letters |
| `admin` | `adminProcedure` | `/admin` | Full platform access, user management |

**Guards defined in:** [server/routers/_guards.ts](server/routers/_guards.ts)

## Key Routers and Procedures

### [letters.ts](server/routers/letters.ts) (subscriberProcedure)
- `submit` — Creates letter_request, triggers pipeline
- `myLetters` — List subscriber's letters with versions
- `detail` — Single letter with version history
- `updateForChanges` — Update intake when attorney requests changes
- `archive` — Soft-delete letter

### [review.ts](server/routers/review.ts) (attorneyProcedure)
- `queue` — Paginated list of letters needing review
- `claim` — Assign letter to attorney (pending_review → under_review)
- `saveEdit` — Save attorney edit version (no status change)
- `approve` — Final approval + PDF generation + email (under_review → approved)
- `reject` — Reject with reason (under_review → rejected)
- `requestChanges` — Request changes, optionally re-trigger AI (under_review → needs_changes)

### [billing.ts](server/routers/billing.ts)
- `checkCanSubmit` — Validate subscriber can submit (quota, payment status)
- `freeUnlock` — First letter free path (generated_locked → pending_review)
- `payToUnlock` — Stripe checkout for pay-per-letter
- `checkPaywallStatus` — Returns paywall state for UI
- `createBillingPortal` — Stripe customer portal link

### [admin.ts](server/routers/admin.ts) (adminProcedure)
- User management, role updates
- Failed job monitoring and retry
- Force status transitions
- Full letter audit trail

## Pricing Source of Truth

**NEVER hardcode prices.** Always import from [shared/pricing.ts](shared/pricing.ts):

```typescript
import { PRICING, PER_LETTER_PRICE_CENTS } from '@/shared/pricing'

// Usage
const price = PRICING.perLetter.price  // 200
const displayPrice = PRICING.perLetter.priceDisplay  // "$200"
const stripePrice = PER_LETTER_PRICE_CENTS  // 20000
```

Pricing model:
- Free Trial: First letter free (research + draft + attorney review)
- Pay-per-letter: $200 one-time
- Monthly Basic: $499/month (4 letters)
- Monthly Pro: $699/month (8 letters)

## Database Access Patterns

Use Drizzle ORM with helpers from [server/db.ts](server/db.ts):

```typescript
import { db } from '@/server/db'
import { letterRequests, users } from '@/drizzle/schema'
import { eq, and, desc } from 'drizzle-orm'

// Query helpers available in db.ts
const letter = await getLetterById(letterId)
const userLetters = await getLettersByUserId(userId)
```

**Schema:** [drizzle/schema.ts](drizzle/schema.ts) — 13 tables including `users`, `letter_requests`, `letter_versions`, `review_actions`, `workflow_jobs`, `research_runs`, `subscriptions`, `payments`, `discount_codes`, `commission_ledger`, `payout_requests`

## Email Templates

Fire-and-forget pattern for non-blocking emails:

```typescript
import { sendLetterReadyEmail, sendLetterApprovedEmail } from '@/server/email'

sendLetterReadyEmail(user.email, { letterId, referenceId }).catch(err =>
  console.error('[Email] Failed:', err)
)
```

**9 templates defined in:** [server/email.ts](server/email.ts)

## tRPC Client Usage

Frontend uses tRPC React hooks:

```typescript
import { trpc } from '@/lib/trpc'

// Queries
const { data: letters } = trpc.letters.myLetters.useQuery()
const { data: paywallStatus } = trpc.billing.checkPaywallStatus.useQuery({ letterId })

// Mutations
const mutateSubmit = trpc.letters.submit.useMutation()
const utils = trpc.useContext()

mutateSubmit.mutate(input, {
  onSuccess: () => {
    utils.letters.myLetters.invalidate()
  }
})
```

## Security Rules

1. **Never expose AI drafts** to subscribers until payment complete (status = `pending_review` or higher)
2. **Never show internal review notes** to subscribers (only user-visible notes)
3. **Always use role guards** on protected procedures — import from [server/routers/_guards.ts](server/routers/_guards.ts)
4. **Validate input with Zod** schemas in all tRPC procedures
5. **Sanitize user input** before using in AI prompts (already handled in [server/pipeline.ts](server/pipeline.ts))
6. **Never log sensitive data** — full intake forms, API keys, PII

## Testing Patterns

Test files use `*.test.ts` or `phase*.test.ts` naming:

```bash
# Run all tests
pnpm test

# Run single test file (use vitest CLI)
pnpm test letters.test.ts
```

**Framework:** Vitest (configured in [vitest.config.ts](vitest.config.ts))

## Environment Variables

Required in `.env`:

```
ANTHROPIC_API_KEY=         # Claude API (stages 2 & 3)
PERPLEXITY_API_KEY=        # Research API (stage 1)
STRIPE_SECRET_KEY=         # Stripe server-side
STRIPE_WEBHOOK_SECRET=     # Webhook verification
SUPABASE_DATABASE_URL=     # PostgreSQL connection
SUPABASE_URL=              # Supabase project URL
SUPABASE_ANON_KEY=         # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY= # Supabase service role (bypasses RLS)
RESEND_API_KEY=            # Email (Resend)
SENTRY_DSN=                # Error monitoring (optional)
UPSTASH_REDIS_REST_URL=    # Rate limiting
UPSTASH_REDIS_REST_TOKEN=  # Rate limiting
```

## Import Aliases (tsconfig.json)

```typescript
// Client-side imports
import { Component } from '@/components/Component'
import { trpc } from '@/lib/trpc'

// Shared types (both client and server)
import { type LetterRequest } from '@shared/types'
import { PRICING } from '@shared/pricing'

// Server-side imports
import { db } from '@/server/db'
import { pipeline } from '@/server/pipeline'
```

## Code Conventions

From [.github/copilot-instructions.md](.github/copilot-instructions.md):

- **File naming:** `camelCase.ts` for TypeScript files, `PascalCase.tsx` for React components
- **Commit messages:** `feat:`, `fix:`, `refactor:` prefixes with detailed description
- **Import style:** Use alias imports (`@/`) over relative paths
- **Type safety:** No `any` types — use Zod validation and proper typing

## External Integrations

- **Supabase:** Auth, PostgreSQL, Storage (PDFs, attachments)
- **Stripe:** Checkout sessions, webhooks, subscriptions
- **Perplexity:** Legal research (Stage 1)
- **Anthropic Claude:** Draft generation and assembly (Stages 2 & 3)
- **Resend:** Transactional emails
- **Upstash Redis:** Rate limiting
- **Sentry:** Error tracking

## MCP Server Access

Configured in `.mcp.json` — Supabase MCP for database queries, auth inspection, and storage operations.

Sync with `pnpm mcp:sync` after adding new MCP servers.

## Additional Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Complete codebase mapping
- **[PROJECT_TODO.md](PROJECT_TODO.md)** — Centralized TODO tracker
- **[docs/skills/letter-generation-pipeline/](docs/skills/letter-generation-pipeline/)** — 3-stage AI pipeline spec
- **[docs/skills/letter-review-pipeline/](docs/skills/letter-review-pipeline/)** — Attorney review workflow spec
