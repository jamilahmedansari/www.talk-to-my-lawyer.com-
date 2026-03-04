---
name: letter-generation-pipeline
description: Complete reference for the Talk to My Lawyer AI letter generation pipeline. Covers the 3-stage orchestrator (Perplexity research → Anthropic draft → Anthropic assembly), intake normalization, status machine, database writes, error handling, and n8n fallback path. Use when building, debugging, or extending the letter generation system.
---

# Letter Generation Pipeline

The letter generation pipeline converts a subscriber's intake form submission into a polished, attorney-ready legal letter through three sequential AI stages. This skill documents every stage, data shape, status transition, and failure mode.

> **⚠️ Schema Changes:** All schema changes must be applied via Drizzle migrations. Follow the `drizzle/migrations/000X_description.sql` naming convention.

## Pipeline Overview

```
Subscriber submits intake form
        │
        ▼
  [routers.ts] letters.submit
        │  Creates letter_request (status: submitted)
        │  Creates workflow_job record
        │  Fires runLetterPipeline() async
        ▼
  ┌─────────────────────────────────────────┐
  │  Stage 1: RESEARCH (Perplexity sonar-pro) │
  │  Status: submitted → researching          │
  │  Timeout: 90s                             │
  │  Output: ResearchPacket JSON              │
  └─────────────────┬───────────────────────┘
                    ▼
  ┌─────────────────────────────────────────┐
  │  Stage 2: DRAFTING (Claude claude-opus-4-5)       │
  │  Status: researching → drafting           │
  │  Timeout: 120s                            │
  │  Output: DraftOutput JSON                 │
  └─────────────────┬───────────────────────┘
                    ▼
  ┌─────────────────────────────────────────┐
  │  Stage 3: ASSEMBLY (Claude claude-opus-4-5)       │
  │  Status: drafting → generated_locked      │
  │  Timeout: 120s                            │
  │  Output: Final letter text (HTML/text)    │
  └─────────────────┬───────────────────────┘
                    ▼
  Letter version created (type: ai_draft)
  Email sent to subscriber ("Your letter is ready")
  Subscriber sees paywall → pays → pending_review
```

## Entry Point

**File:** `server/routers.ts` → `letters.submit`

The submit procedure:
1. Validate intake JSON via Zod schema
2. Call `createLetterRequest()` → insert into `letter_requests` table (status: `submitted`)
3. Call `createAttachment()` for each uploaded file
4. Fire `runLetterPipeline(letterId, intakeJson)` **asynchronously** (non-blocking)
5. Return `{ letterId }` to the client immediately

## Intake Normalization

**File:** `server/intake-normalizer.ts`

Before any AI stage, raw intake JSON is normalized via `buildNormalizedPromptInput(dbFields, intakeJson)`. This produces a canonical `NormalizedPromptInput` object used by all prompt builders.

Key normalizations:
- Trim all strings, safe defaults for missing fields
- Merge DB-level fields (subject, jurisdiction) with intake JSON
- Resolve tone from `toneAndDelivery.tone` or legacy `tonePreference`
- Resolve delivery method from `toneAndDelivery.deliveryMethod` or legacy field
- Resolve prior communication from `communications.summary` or legacy field

**Input shape:** See `references/data-shapes.md` → IntakeJson

## Stage 1: Legal Research

**Provider:** Perplexity API (`sonar-pro` model) via OpenAI-compatible client
**Fallback:** If `PERPLEXITY_API_KEY` is not set, falls back to Claude claude-opus-4-5
**Timeout:** 90 seconds

### What It Does
1. Status transition: `submitted` → `researching`
2. Build research prompt from normalized intake (jurisdiction, matter type, issues)
3. Call Perplexity with web-grounded search for applicable laws, statutes, case precedents
4. Parse response as `ResearchPacket` JSON
5. Store research in `research_runs` table and as a `letter_version` (type: ai_draft, stage: research)
6. Create `workflow_job` record for the stage

### Research Prompt Strategy
The prompt instructs the AI to produce a structured JSON `ResearchPacket` containing:
- Jurisdiction profile (country, state, city, authority hierarchy)
- Issues identified from the matter description
- Applicable rules with citations, source URLs, confidence levels
- Local jurisdiction elements (specific requirements)
- Risk flags and drafting constraints
- Open questions for attorney review

### Output Shape
See `references/data-shapes.md` → ResearchPacket

## Stage 2: Legal Drafting

**Provider:** Anthropic Claude (`claude-opus-4-5`)
**Timeout:** 120 seconds

### What It Does
1. Status transition: `researching` → `drafting`
2. Build drafting prompt from normalized intake + ResearchPacket
3. Instruct Claude to produce a structured legal letter draft
4. Parse response as `DraftOutput` JSON
5. Create `workflow_job` record for the stage

### Drafting Prompt Strategy
The prompt provides:
- Full normalized intake data
- Complete ResearchPacket from Stage 1
- Instructions for letter structure (header, salutation, body, demands, deadline, closing)
- Tone calibration based on `tonePreference`
- Jurisdiction-specific requirements from research
- Instructions to flag open questions and risk areas for attorney review

### Output Shape
See `references/data-shapes.md` → DraftOutput

## Stage 3: Final Assembly

**Provider:** Anthropic Claude (`claude-opus-4-5`)
**Timeout:** 120 seconds
**Exported as:** `runAssemblyStage()` (also used by n8n callback)

### What It Does
1. Build assembly prompt from intake + research + draft
2. Instruct Claude to polish, format, and finalize the letter
3. Create `letter_version` record (type: `ai_draft`) with final content
4. Update `letter_requests.currentAiDraftVersionId` pointer
5. Status transition: `drafting` → `generated_locked` or `generated_unlocked` (free-trial path)
6. Send "letter ready" email to subscriber
7. Create `workflow_job` record for the stage

## Status Machine

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

Valid transitions defined in `shared/types.ts` → `ALLOWED_TRANSITIONS`.

## Error Handling & Retry

### On Pipeline Failure
- Status reverts to `submitted`
- `workflow_job` record updated with error details and `failed` status
- Review action logged: `pipeline_failed`
- Subscriber is NOT notified of failure (silent retry expected)

### Retry Mechanism
- **Admin retry:** `admin.retryJob` procedure → calls `retryPipelineFromStage(letterId, intakeJson, stage)`
- **Attorney re-trigger:** `review.requestChanges` with `retriggerPipeline: true` → retries from specified stage
- Retry can start from `research` or `drafting` stage (skips completed stages)

## n8n Fallback Path (Dormant)

**Activation:** Requires ALL three conditions:
1. `N8N_PRIMARY=true` environment variable
2. `N8N_WEBHOOK_URL` is set
3. URL starts with `https://`

**Currently:** `N8N_PRIMARY` is NOT set → always uses direct 3-stage path.

When active, the n8n path:
1. POST intake to n8n webhook URL
2. n8n runs its own research + draft workflow
3. n8n POSTs results back to `/api/pipeline/n8n-callback`
4. Callback handler (`server/n8nCallback.ts`) processes results

## Database Writes During Pipeline

| Stage | Table | Record Type |
|-------|-------|-------------|
| Submit | `letter_requests` | New request (status: submitted) |
| Submit | `attachments` | File references (S3 keys) |
| Submit | `workflow_jobs` | Job tracking record |
| Research | `research_runs` | Research packet storage |
| Research | `letter_versions` | Research content (ai_draft, stage: research) |
| Draft | `workflow_jobs` | Stage completion record |
| Assembly | `letter_versions` | Final draft (ai_draft) |
| Assembly | `review_actions` | Pipeline completion log |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | **Yes** | Stages 2 + 3 (Claude claude-opus-4-5) |
| `SONAR_API_KEY` / `PERPLEXITY_API_KEY` | Recommended | Stage 1 research (falls back to Claude) |
| `N8N_WEBHOOK_URL` | No | n8n webhook (dormant) |
| `N8N_CALLBACK_SECRET` | No | n8n auth header |
| `N8N_PRIMARY` | No | Activate n8n path (default: off) |
| `RESEND_API_KEY` | Yes | Email notifications |

## Key Source Files

| File | Purpose |
|------|---------|
| `server/pipeline.ts` | 3-stage orchestrator + all prompt builders |
| `server/intake-normalizer.ts` | Canonical intake normalization |
| `server/n8nCallback.ts` | n8n webhook handler (dormant) |
| `server/routers.ts` (L1-180) | `letters.submit` procedure |
| `server/db.ts` (L119-280) | Letter request CRUD helpers |
| `drizzle/schema.ts` | Database schema + enums |
| `shared/types.ts` | IntakeJson, ResearchPacket, DraftOutput types |

## Reference Files

- **Data shapes (IntakeJson, ResearchPacket, DraftOutput, NormalizedPromptInput):** See `references/data-shapes.md`
- **Prompt templates and strategies:** See `references/prompt-strategies.md`
- **Status transitions and workflow jobs:** See `references/status-workflow.md`

## Agent Init (Required)

Before starting work in this skill, initialize with the current frontend issue register (`agentId: a28925291b7edfefb`) and treat these as active priorities:

- Critical: remove unsafe `as any` usage, fix email verification typing/logic, improve localStorage failure handling, replace SPA-breaking redirects, and surface upload/submission failures.
- High: file upload hardening, auth race-condition mitigation, localStorage write frequency/debounce, Theme context hydration handling, suspense error boundaries, and polling/realtime coordination.
- Medium/Low: logo/config hardcoding, pagination coverage, accessibility gaps, optimistic updates, production-safe logging, shared status enums, and form-state architecture cleanup.

If implementation scope is unclear, default to Critical issues first.
