# Status Transitions & Workflow Jobs Reference

## Table of Contents
- [Status Enum Values](#status-enum-values)
- [Allowed Transitions Map](#allowed-transitions-map)
- [Pipeline Status Flow](#pipeline-status-flow)
- [Payment Unlock Flow](#payment-unlock-flow)
- [Retry Flows](#retry-flows)
- [Workflow Job Lifecycle](#workflow-job-lifecycle)

---

## Status Enum Values

Defined in `drizzle/schema.ts` → `letterStatusEnum`:

| Status | Label | Description |
|--------|-------|-------------|
| `submitted` | Submitted | Initial state after intake form submission |
| `researching` | Researching | Stage 1 in progress (Perplexity research) |
| `drafting` | Drafting | Stage 2 in progress (Claude drafting) |
| `generated_locked` | Draft Ready | Pipeline complete, awaiting payment |
| `generated_unlocked` | Draft Ready | Legacy status (backward compat only) |
| `pending_review` | Awaiting Review | Paid/free-unlocked, waiting for attorney |
| `under_review` | Under Review | Attorney has claimed and is reviewing |
| `needs_changes` | Changes Requested | Attorney requested changes |
| `approved` | Approved | Attorney approved, PDF generated |
| `rejected` | Rejected | Attorney rejected the letter |

---

## Allowed Transitions Map

Source: `shared/types.ts` → `ALLOWED_TRANSITIONS`

```typescript
{
  submitted:        ["researching"],
  researching:      ["drafting"],
  drafting:         ["generated_locked"],
  generated_locked: ["pending_review"],
  pending_review:   ["under_review"],
  under_review:     ["approved", "rejected", "needs_changes"],
  needs_changes:    ["researching", "drafting"],
}
```

**Admin override:** `admin.forceStatusTransition` can set ANY status regardless of the transition map.

---

## Pipeline Status Flow

### Happy Path (Direct 3-Stage)
```
submitted ──[runLetterPipeline]──→ researching
    ──[Stage 1 complete]──→ drafting
    ──[Stage 3 complete]──→ generated_locked
```

### Failure Path
```
submitted ──→ researching ──[Stage 1 fails]──→ submitted (reverted)
submitted ──→ researching ──→ drafting ──[Stage 2/3 fails]──→ submitted (reverted)
```

### n8n Path (When Active)
```
submitted ──[webhook fired]──→ researching
    ──[n8n callback received]──→ drafting
    ──[assembly complete]──→ generated_locked
```

---

## Payment Unlock Flow

### First Letter Free
```
generated_locked ──[billing.freeUnlock]──→ pending_review
```
Conditions: User has zero previously unlocked letters.

### Pay-Per-Letter ($200)
```
generated_locked ──[billing.payToUnlock → Stripe checkout]──→ (Stripe webhook) ──→ pending_review
```

### Trial Review ($50)
```
generated_unlocked ──[billing.payTrialReview → Stripe checkout]──→ (Stripe webhook) ──→ pending_review
```

### Subscription (Monthly/Annual)
Active subscribers bypass the paywall entirely. The `checkPaywallStatus` procedure returns `{ state: "subscribed" }`.

---

## Retry Flows

### Admin Retry
```
submitted (or failed) ──[admin.retryJob(stage: "research")]──→ researching ──→ ...
submitted (or failed) ──[admin.retryJob(stage: "drafting")]──→ drafting ──→ ...
```

### Attorney Re-trigger
```
needs_changes ──[review.requestChanges(retriggerPipeline: true)]──→ researching or drafting ──→ ...
```

---

## Workflow Job Lifecycle

Each pipeline stage creates a `workflow_jobs` record:

```
queued ──→ running ──→ completed
                   └──→ failed
```

### Job Fields
- `jobType`: `"research"` | `"drafting"` | `"assembly"`
- `provider`: `"perplexity"` | `"anthropic"` | `"n8n"`
- `inputPayload`: Normalized intake JSON
- `outputPayload`: Stage output (ResearchPacket, DraftOutput, or final text)
- `errorMessage`: Error details on failure

### Admin Monitoring
- `admin.failedJobs` → lists all failed jobs (limit 100)
- `admin.letterJobs` → lists all jobs for a specific letter
- `admin.purgeFailedJobs` → deletes all failed job records
