---
name: letter-review-pipeline
description: Complete reference for the Talk to My Lawyer attorney review pipeline. Covers the full review workflow from payment unlock through attorney claim, inline editing, approval/rejection, PDF generation, and subscriber notification. Use when building, debugging, or extending the letter review center, attorney dashboard, or approval workflow.
---

# Letter Review Pipeline

The letter review pipeline handles everything that happens after the AI generates a letter draft and the subscriber pays to unlock it. It covers the attorney review workflow, inline editing, approval/rejection decisions, PDF generation, and all associated notifications.

> **⚠️ Schema Changes:** All schema changes must be applied via Drizzle migrations. Follow the `drizzle/migrations/000X_description.sql` naming convention.

## Review Pipeline Overview

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
  │  Subscriber notified ("Attorney reviewing your letter")
        │
        ▼
  under_review
  │  Attorney sees: intake panel, attachments, AI draft, research
  │  Attorney can: edit inline, save edits, add notes
        │
        ▼
  [Attorney Decision]
  ├── APPROVE → approved
  │   │  Creates final_approved version
  │   │  Generates PDF via PDFKit
  │   │  Uploads PDF to S3
  │   │  Sends approval email with PDF link
  │   │  Creates in-app notification
  │   ▼
  │   Subscriber downloads PDF from "My Letters"
  │
  ├── REJECT → rejected
  │   │  Logs rejection reason (internal + user-visible)
  │   │  Sends rejection email
  │   │  Creates in-app notification
  │   ▼
  │   Terminal state
  │
  └── REQUEST CHANGES → needs_changes
      │  Logs change request (internal + user-visible)
      │  Sends "changes needed" email
      │  Optionally re-triggers AI pipeline
      ▼
      Can loop back to researching or drafting
```

## Entry Points

### Payment Unlock (Subscriber Side)

**File:** `server/routers.ts` → `billing.*`

| Procedure | Condition | Transition |
|-----------|-----------|------------|
| `billing.freeUnlock` | First letter, no prior unlocked letters | `generated_locked` or `generated_unlocked` → `pending_review` |
| `billing.payToUnlock` | Creates $200 Stripe checkout | Stripe webhook → `pending_review` |
| `billing.createAttorneyReviewCheckout` | Creates $100 Stripe checkout for free-trial letters | Stripe webhook → `pending_review` |

The Stripe webhook handler (`server/stripeWebhook.ts`) processes `checkout.session.completed` events and transitions the letter status.

### Review Queue (Attorney Side)

**File:** `server/routers.ts` → `review.*`

All review procedures require `attorneyProcedure` guard (role: `attorney` or `admin`).

## Review Actions (5 Core Operations)

### 1. Claim Letter

**Procedure:** `review.claim`
**Input:** `{ letterId: number }`
**Transition:** `pending_review` → `under_review`

What happens:
1. Verify letter exists and is in `pending_review` status
2. Call `claimLetterForReview(letterId, reviewerId)` — idempotent, rejects if already claimed by another
3. Log review action: `claimed_for_review`
4. Send email to subscriber: "An attorney is reviewing your letter"
5. Create in-app notification for subscriber

### 2. Save Edit

**Procedure:** `review.saveEdit`
**Input:** `{ letterId: number, content: string (min 50 chars), note?: string }`
**No status transition** (stays `under_review`)

What happens:
1. Verify letter exists
2. Create `letter_version` record (type: `attorney_edit`)
3. Log review action: `attorney_edit_saved`
4. Return `{ versionId }`

Attorneys can save multiple edits before making a final decision.

### 3. Approve

**Procedure:** `review.approve`
**Input:**
```typescript
{
  letterId: number;
  finalContent: string;       // min 100 chars
  internalNote?: string;      // visible only to staff
  userVisibleNote?: string;   // visible to subscriber
}
```
**Transition:** `under_review` → `approved`

What happens:
1. Verify letter is in `under_review` status
2. Create `letter_version` (type: `final_approved`) with `finalContent`
3. Update `currentFinalVersionId` pointer on letter request
4. Update status to `approved`
5. Log review action: `approved` (internal note)
6. If `userVisibleNote` provided, log additional `attorney_note` action (user-visible)
7. **Generate PDF** via `generateAndUploadApprovedPdf()` (non-blocking)
8. Upload PDF to S3, store URL in `letter_requests.pdfUrl`
9. Send approval email to subscriber (includes PDF download link)
10. Create in-app notification for subscriber

### 4. Reject

**Procedure:** `review.reject`
**Input:**
```typescript
{
  letterId: number;
  reason: string;              // min 10 chars, internal
  userVisibleReason?: string;  // shown to subscriber (defaults to reason)
}
```
**Transition:** `under_review` → `rejected`

What happens:
1. Verify letter is in `under_review` status
2. Update status to `rejected`
3. Log review action: `rejected` (internal)
4. Log review action: `rejection_notice` (user-visible reason)
5. Send rejection email to subscriber
6. Create in-app notification for subscriber

### 5. Request Changes

**Procedure:** `review.requestChanges`
**Input:**
```typescript
{
  letterId: number;
  internalNote?: string;
  userVisibleNote: string;     // min 10 chars
  retriggerPipeline: boolean;  // default: false
}
```
**Transition:** `under_review` → `needs_changes`

What happens:
1. Verify letter is in `under_review` status
2. Update status to `needs_changes`
3. Log review action: `requested_changes` (internal)
4. Log review action: `changes_requested` (user-visible)
5. Send "changes needed" email to subscriber
6. Create in-app notification
7. If `retriggerPipeline: true`, call `retryPipelineFromStage(letterId, intakeJson, "drafting")` async

## PDF Generation

**File:** `server/pdfGenerator.ts`

Triggered on approval. Produces a professional legal letter PDF with:
- Navy branded letterhead ("TALK TO MY LAWYER")
- Metadata row (letter type, reference number, jurisdiction)
- Date line
- Sender block (name, address, email, phone)
- Recipient block
- Re: subject line with divider
- Letter body (Times New Roman 12pt, 1-inch margins)
- Attorney approval stamp (green box with checkmark)
- Running footer on all pages (disclaimer + page numbers)

### PDF Flow
```
Approve action
    │
    ▼
generateAndUploadApprovedPdf()
    │  generatePdfBuffer() → PDFKit in-memory
    │  storagePut(fileKey, buffer, "application/pdf") → S3
    ▼
Return { pdfUrl, pdfKey }
    │
    ▼
updateLetterPdfUrl(letterId, pdfUrl)
```

PDF generation is **non-blocking**: if it fails, the approval still succeeds. The error is logged but does not roll back the approval.

## Notification System

**File:** `server/email.ts`

All review actions trigger both email and in-app notifications:

| Action | Email Function | Notification Type |
|--------|---------------|-------------------|
| Claim | `sendLetterUnderReviewEmail` | `letter_under_review` |
| Approve | `sendLetterApprovedEmail` | `letter_approved` |
| Reject | `sendLetterRejectedEmail` | `letter_rejected` |
| Request Changes | `sendNeedsChangesEmail` | `needs_changes` |
| Assign (admin) | `sendNewReviewNeededEmail` | N/A |

In-app notifications are stored in the `notifications` table and displayed via `notifications.list` procedure.

## Review Action Audit Trail

**Table:** `review_actions`

Every review operation creates an audit record via `logReviewAction()`:

```typescript
{
  letterRequestId: number;
  reviewerId?: number;
  actorType: "system" | "subscriber" | "employee" | "admin" | "attorney";
  action: string;          // claimed, approved, rejected, etc.
  noteText?: string;
  noteVisibility: "internal" | "user_visible";
  fromStatus?: string;
  toStatus?: string;
  createdAt: timestamp;
}
```

**Visibility rules:**
- `internal`: Only visible to attorneys and admins
- `user_visible`: Visible to the subscriber who owns the letter

## Version History

**Table:** `letter_versions`

Versions created during review:

| Version Type | Created By | When |
|-------------|-----------|------|
| `ai_draft` | system | Pipeline completion (Stage 3) |
| `attorney_edit` | attorney | Each `review.saveEdit` call |
| `final_approved` | attorney | On `review.approve` |

The letter request tracks two version pointers:
- `currentAiDraftVersionId` → latest AI-generated draft
- `currentFinalVersionId` → approved version (set on approval)

## Admin Review Controls

**File:** `server/routers.ts` → `admin.*`

| Procedure | Purpose |
|-----------|---------|
| `admin.assignLetter` | Assign a letter to a specific employee/attorney |
| `admin.forceStatusTransition` | Override status to any value |
| `admin.getLetterDetail` | Full letter detail with all versions, actions, jobs |
| `admin.retryJob` | Re-trigger pipeline from a specific stage |

## Frontend Pages

| Page | Route | Role | Purpose |
|------|-------|------|---------|
| Attorney Dashboard | `/attorney` | attorney, admin | Overview stats |
| Review Queue | `/attorney/queue` | attorney, admin | List of letters to review |
| Review Detail | `/attorney/:id` | attorney, admin | Full review interface |
| Letter Detail | `/letters/:id` | subscriber | View letter status, download PDF |
| Admin Letter Detail | `/admin/letters/:id` | admin | Full audit view |

## Key Source Files

| File | Purpose |
|------|---------|
| `server/routers.ts` (L380-622) | All `review.*` procedures |
| `server/routers.ts` (L625-724) | All `admin.*` procedures |
| `server/routers.ts` (L762-991) | All `billing.*` procedures |
| `server/pdfGenerator.ts` | PDFKit PDF generation |
| `server/email.ts` | Email notification templates |
| `server/db.ts` (L229-460) | Review-related DB helpers |
| `server/stripeWebhook.ts` | Stripe payment webhook |
| `server/storage.ts` | S3 file upload |

## Reference Files

- **Review action types and visibility rules:** See `references/review-actions.md`
- **PDF generation details and branding:** See `references/pdf-generation.md`
- **Payment and paywall flow:** See `references/payment-flow.md`

## Agent Init (Required)

Before beginning any task in this skill, initialize with the active frontend issue register (`agentId: a28925291b7edfefb`).

- Critical first: eliminate unsafe `as any`, enforce typed email verification checks, improve localStorage and upload/submission error handling, and remove non-SPA redirects.
- High next: upload security hardening, auth race mitigation, draft save debounce, suspense boundary coverage, and polling/realtime race control.
- Medium/Low cleanup: configurable assets, pagination/accessibility gaps, optimistic updates, production-safe logging, shared status constants.
