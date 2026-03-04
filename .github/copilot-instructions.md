# GitHub Copilot Instructions — Talk to My Lawyer

> **Project:** Talk to My Lawyer — AI-powered legal letter generation platform
> **Tech Stack:** React 19 + Vite + TypeScript | Express + tRPC | PostgreSQL + Drizzle | Supabase Auth | Stripe
> **Canonical TODO:** See [PROJECT_TODO.md](../PROJECT_TODO.md)
> **Full Architecture:** See [ARCHITECTURE.md](../ARCHITECTURE.md)

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
feat: add Stripe payment integration for letter unlock
fix: resolve email verification race condition
refactor: extract billing router from monolith
```

## Role System (4 Roles)

| Role | Guard | Dashboard |
|------|-------|-----------|
| `subscriber` | `subscriberProcedure` | `/dashboard` |
| `employee` | `employeeProcedure` | `/employee` |
| `attorney` | `attorneyProcedure` | `/attorney` |
| `admin` | `adminProcedure` | `/admin` |

```typescript
// Use appropriate procedure guards:
import { publicProcedure, protectedProcedure, subscriberProcedure, attorneyProcedure, adminProcedure } from '@/server/routers/_guards'
```

## Type Safety Rules

```typescript
// ❌ AVOID — Unsafe casts
const data = someValue as any

// ✅ PREFERRED — Type guards and Zod validation
const schema = z.object({ field: z.string() })
const validated = schema.parse(rawInput)
```

## Database Queries (Drizzle ORM)

```typescript
// ✅ PREFERRED — Use Drizzle ORM
import { letterRequests } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

const letters = await db
  .select()
  .from(letterRequests)
  .where(eq(letterRequests.userId, userId))
```

## Letter Generation Pipeline

```
Stage 1: Perplexity (sonar-pro) → Legal Research (90s timeout)
Stage 2: Anthropic Claude (claude-opus-4-5) → Initial Draft (120s timeout)
Stage 3: Anthropic Claude (claude-opus-4-5) → Final Assembly (120s timeout)
```

### Status Machine

```
submitted → researching → drafting → generated_locked
→ [payment] → pending_review → under_review → approved | rejected | needs_changes
needs_changes → researching | drafting
```

### Key Pipeline Files

- `server/pipeline.ts` — Orchestrator + prompt builders
- `server/intake-normalizer.ts` — Intake normalization
- `server/routers/letters.ts` — Submit procedure (triggers pipeline)

## Review Workflow

```typescript
review.claim({ letterId })        // pending_review → under_review
review.saveEdit({ letterId, content, note? })  // no status change
review.approve({ letterId, finalContent, internalNote?, userVisibleNote? })  // → approved + PDF
review.reject({ letterId, reason, userVisibleReason? })  // → rejected
review.requestChanges({ letterId, internalNote?, userVisibleNote, retriggerPipeline? })  // → needs_changes
```

## Payment Processing

```typescript
billing.freeUnlock({ letterId })    // First letter only, generated_locked → pending_review
billing.payToUnlock({ letterId })   // Stripe checkout, webhook → pending_review
billing.checkPaywallStatus()        // Returns: { state: 'free' | 'subscribed' | 'pay_per_letter' }
```

## Email Templates

```typescript
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

### Route Guards
```typescript
import { ProtectedRoute } from '@/components/ProtectedRoute'

<Route path="/attorney/queue" element={
  <ProtectedRoute allowedRoles={['attorney', 'admin']}>
    <ReviewQueue />
  </ProtectedRoute>
} />
```

### tRPC Hooks
```typescript
import { trpc } from '@/lib/trpc'

const { data: letters } = trpc.letters.myLetters.useQuery()
const mutateSubmit = trpc.letters.submit.useMutation()

const utils = trpc.useContext()
mutateSubmit.mutate(input, {
  onSuccess: () => utils.letters.myLetters.invalidate()
})
```

## Error Handling

```typescript
// ✅ Fire-and-forget for non-blocking
sendEmail(to, data).catch(err => console.error('[Email] Failed:', err))

// ✅ TRPCError for API errors
throw new TRPCError({ code: 'NOT_FOUND', message: 'Letter not found' })
```

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` — Claude API
- `PERPLEXITY_API_KEY` — Research API
- `STRIPE_SECRET_KEY` — Payments
- `SUPABASE_DATABASE_URL` — Database
- `RESEND_API_KEY` — Email

## Security Best Practices

1. **Never expose AI drafts to subscribers** until payment complete
2. **Never show internal review notes** to subscribers
3. **Always verify email** before allowing protected actions
4. **Use role guards** on all protected procedures
5. **Validate input** with Zod schemas
6. **Sanitize user input** before using in prompts
7. **Never log sensitive data** (full intake, API keys)

## Agent Tool Access

All coding agents should have access to:
- **File Read/Write/Edit** — Source files, tests, migrations
- **Execute** — `pnpm tsc --noEmit`, `pnpm test`, `pnpm dev`
- **Supabase MCP** — DB queries, auth inspection, storage (configured in `.mcp.json`)
- **Stripe MCP** — Payment inspection (if configured)

### Agent Workflow Checklist

1. **Read** relevant source files before making changes
2. **Edit** only necessary lines (avoid full-file rewrites)
3. **Execute** `pnpm tsc --noEmit` — 0 TypeScript errors required
4. **Execute** `pnpm test` — all tests must pass
5. **Write** new tests if adding a feature or fixing a bug
6. **Update** [PROJECT_TODO.md](../PROJECT_TODO.md) if completing a tracked item

## Quick Reference

| What | Where |
|------|-------|
| Pipeline orchestrator | `server/pipeline.ts` |
| Letter procedures | `server/routers/letters.ts` |
| Review procedures | `server/routers/review.ts` |
| Billing procedures | `server/routers/billing.ts` |
| Admin procedures | `server/routers/admin.ts` |
| DB helpers | `server/db.ts` |
| Email templates | `server/email.ts` |
| PDF generation | `server/pdfGenerator.ts` |
| Type definitions | `shared/types.ts` |
| Database schema | `drizzle/schema.ts` |
| Auth guards | `server/routers/_guards.ts` |
| Frontend routing | `client/src/App.tsx` |
| Route protection | `client/src/components/ProtectedRoute.tsx` |
