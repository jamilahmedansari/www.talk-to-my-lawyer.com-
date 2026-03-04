# Talk to My Lawyer — Project TODO Tracker

> **Last Updated:** 2026-03-04
> **Purpose:** Single source of truth TODO list across all coding agents (GitHub Copilot, Claude, Codex, etc.)
> **Usage:** Mark items as `[x]` when completed. All agents should continue from the last completed item.

---

## Completed Phases (1–16) — Summary

All foundation, auth, subscriber portal, attorney review center, admin dashboard, AI pipeline, Stripe payments, email notifications, paywall flow, and dev email preview phases are **complete**. See git history for details.

Key milestones:
- **Phase 1–5:** Schema, auth, subscriber portal, review center, admin dashboard
- **Phase 6:** 3-stage AI pipeline (Perplexity → Claude → Claude)
- **Phase 8:** E2E workflow audit, 3rd AI stage added
- **Phase 12:** Stripe payment integration
- **Phase 14:** Paywall flow (`generated_locked` status, pay-to-unlock)
- **Phase 15:** Post-submission email notifications
- **Phase 16:** Dev email preview endpoint (38/38 tests passing)

---

## Active TODO — Remaining Work

### Phase 10: Spec Compliance Patches
- [ ] Add `buildNormalizedPromptInput` helper (trim strings, safe defaults, filter empty rows)
- [ ] Strengthen `validateResearchPacket`: require `sourceUrl` + `sourceTitle` per rule, prefer ≥ 3 rules
- [ ] Add subscriber `updateForChanges` mutation (re-submit after `needs_changes`)
- [ ] Add admin `forceStatusTransition` mutation (audited)
- [x] Add frontend polling/revalidation for `researching`/`drafting`/`pending_review` statuses
- [ ] Add status timeline component in subscriber LetterDetail
- [ ] Add subscriber update form when status is `needs_changes`
- [ ] Verify success path E2E (submit → research → draft → assembly → `generated_locked` → unlock → `pending_review` → claim → approve → subscriber sees final)
- [ ] Verify failure path (invalid research stops pipeline, invalid draft stops pipeline)
- [ ] Verify security (subscriber cannot access `ai_draft`/research/internal notes)

### Phase 11: n8n Workflow Integration & Frontend Polish
- [ ] Get n8n workflow webhook URL for the best legal letter workflow
- [ ] Activate the n8n workflow so webhook is live
- [ ] Update `pipeline.ts` to call n8n webhook as primary, with in-app AI fallback
- [ ] Add `N8N_WEBHOOK_URL` as environment variable
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

### Phase 14 Remaining
- [ ] Build Payment Receipts page with invoice history, amounts, dates, receipt links
- [ ] Enhance subscriber Dashboard: subscription status widget, activity feed, quick action cards
- [ ] Add date range filter to Letters History

### Backlog — Future Enhancements
- [ ] PDF export for final approved letters (in addition to server-generated PDFs)
- [ ] Mobile PWA optimization
- [ ] `research_sources` as a separate table (better source querying/display)
- [ ] Rewrite MyLetters with approved-letters hero section
- [ ] Wire attorney notification emails (`admin.assignLetter` → email, `review.approve` → attorney email)
- [ ] Create Profile Settings pages for all roles (unified page with role-specific sections)
- [ ] Remove all remaining `as any` casts from codebase
- [ ] Add error boundaries to all route-level components
- [ ] Add optimistic updates to review actions
- [ ] Add accessibility improvements (ARIA labels, keyboard navigation)
- [ ] Clean stale `generated_unlocked` references from Dashboard.tsx and MyLetters.tsx

---

**Note:** This is the **only** TODO tracker. Do not duplicate in other files. All docs should link here.
