# Talk-to-My-Lawyer TODO

## Phase 1: Foundation
- [x] Database schema (users roles, letter_requests, letter_versions, review_actions, workflow_jobs, research_runs, attachments, notifications)
- [x] Status machine enum and transition validation (submitted → researching → drafting → pending_review → under_review → approved/rejected/needs_changes, NO draft state)
- [x] Global design system (color palette, typography, theme)

## Phase 2: Auth & Navigation
- [x] Role-based user system (subscriber, employee, admin)
- [x] Role-based routing and navigation
- [x] DashboardLayout with sidebar for each role (AppLayout component)
- [x] Login/auth flow with role detection and auto-redirect

## Phase 3: Subscriber Portal
- [x] Multi-step letter intake form (jurisdiction, matter type, parties, facts, desired outcome)
- [x] File upload for attachments (S3 integration)
- [x] My Letters list page with status badges
- [x] Letter detail page (status timeline, intake summary, final approved letter only)
- [x] Secure data isolation — subscribers never see AI drafts or research

## Phase 4: Employee/Attorney Review Center
- [x] Review queue with filtering (pending_review, under_review, needs_changes)
- [x] Review detail page with intake panel, AI draft editor, research panel
- [x] Claim/assign letter for review
- [x] Save attorney edit version
- [x] Approve/reject/request changes actions
- [x] Review actions audit trail

## Phase 5: Admin Dashboard
- [x] Failed jobs monitor
- [x] Retry failed pipeline jobs
- [x] System health overview (queue counts, status distribution)
- [x] User management (role assignment)

## Phase 6: AI Pipeline
- [x] Stage 1: Perplexity API research (jurisdiction rules, statutes, case law)
- [x] Research packet validation gate
- [x] Stage 2: OpenAI drafting from validated research
- [x] Draft parser/validator
- [x] Pipeline orchestration (status transitions, job logging)
- [x] Failure handling and retry logic

## Phase 6b: High-Priority Additions
- [x] Deterministic research packet validator (validateResearchPacket)
- [x] Deterministic draft JSON parser/validator (parseAndValidateDraftLlmOutput)
- [x] Subscriber-safe detail endpoint (never returns ai_draft/attorney edits/internal research)
- [x] Notification system via Resend email (subscriber: needs_changes/approved/rejected; attorney/admin: pending_review/failed jobs)
- [x] Transactional email templates: status change, approval, rejection, needs_changes, new_review_needed
- [x] Resend API key configuration (via webdev_request_secrets)
- [x] Claim/assignment locking in attorney review queue
- [x] Retry failed job controls for admins
- [x] Idempotency protections for duplicate submissions/retries
- [x] Note visibility (internal vs user_visible) in review actions
- [x] Final approved version generation on approval (freeze version + current_final_version_id)
- [ ] PDF export / downloadable output for final letters (future enhancement)

## Phase 7: Testing & Delivery
- [x] Vitest unit tests for critical paths (29 tests passing)
- [x] End-to-end verification (TypeScript clean, server healthy)
- [ ] Save checkpoint and deliver

## Future Enhancements
- [ ] PDF export for final approved letters
- [ ] n8n workflow integration for letter generation
- [ ] Stripe payment integration for subscriptions
- [ ] Mobile PWA optimization
