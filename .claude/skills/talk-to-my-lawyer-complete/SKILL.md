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
                                  │
                                  └──────────────→ generated_unlocked
                                                        │
                                                        ├─→ pending_review
                                                        └─→ upsell_dismissed
generated_locked ─────────────────────────────────────→ pending_review
pending_review ──→ under_review ──→ approved | rejected | needs_changes
needs_changes ──→ researching | drafting
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
| Attorney Review Upsell | $100 | Optional review for free-trial letters (`generated_unlocked`) |
| Monthly Basic | $499/month | 4 letters |
| Monthly Pro | $699/month | 8 letters |

### Payment Flow

**Free Unlock:**
```typescript
billing.freeUnlock({ letterId })
  → Verify first letter (no prior unlocks)
  → Transition: generated_locked OR generated_unlocked → pending_review
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
- Use **camelCase** for all TypeScript files: `letters.ts`, `intake-normalizer.ts`, `pdfGenerator.ts`
- Test files: `*.test.ts` or `phase*.test.ts`
- Component files: `PascalCase.tsx` for React components
- Database migrations: `drizzle/####_description.sql`

### Import Style
