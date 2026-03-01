# Review Actions Reference

## Table of Contents
- [Action Types](#action-types)
- [Visibility Rules](#visibility-rules)
- [Review Action Schema](#review-action-schema)
- [Subscriber-Safe Data Access](#subscriber-safe-data-access)

---

## Action Types

All actions logged via `logReviewAction()` in `server/db.ts`:

| Action | Actor | Visibility | When |
|--------|-------|-----------|------|
| `claimed` | attorney | internal | Attorney claims letter from queue |
| `attorney_edit_saved` | attorney | internal | Attorney saves inline edit |
| `approved` | attorney | internal | Attorney approves letter |
| `attorney_note` | attorney | user_visible | Attorney adds note visible to subscriber |
| `rejected` | attorney | internal | Attorney rejects letter |
| `rejection_notice` | attorney | user_visible | Rejection reason shown to subscriber |
| `requested_changes` | attorney | internal | Attorney requests changes (internal note) |
| `changes_requested` | attorney | user_visible | Change request shown to subscriber |
| `free_unlock` | subscriber | internal | First-letter-free unlock |
| `pipeline_failed` | system | internal | AI pipeline failure |
| `ai_pipeline_completed` | system | internal | AI pipeline success |
| `status_transition` | system | internal | Automated status change |
| `admin_force_status_transition` | admin | internal | Admin overrides status |
| `assigned_reviewer` | admin | internal | Admin assigns letter to reviewer |

---

## Visibility Rules

### Internal (`noteVisibility: "internal"`)
- Visible to: attorneys, admins
- NOT visible to: subscribers
- Used for: operational notes, error logs, internal decisions

### User-Visible (`noteVisibility: "user_visible"`)
- Visible to: the subscriber who owns the letter + attorneys + admins
- Used for: attorney notes, rejection reasons, change requests

### Query Functions
- `getReviewActions(letterId, includeInternal: boolean)` — when `includeInternal=false`, filters to user_visible only
- Subscriber endpoints always call with `includeInternal=false`
- Attorney/admin endpoints call with `includeInternal=true`

---

## Review Action Schema

```typescript
// drizzle/schema.ts → reviewActions table
{
  id: serial;
  letterRequestId: integer;       // FK → letter_requests.id
  reviewerId: integer | null;     // FK → users.id (null for system actions)
  actorType: actorTypeEnum;       // system | subscriber | employee | admin | attorney
  action: varchar(100);           // See action types above
  noteText: text | null;
  noteVisibility: varchar(20);    // "internal" | "user_visible"
  fromStatus: varchar(50) | null;
  toStatus: varchar(50) | null;
  createdAt: timestamp;
}
```

---

## Subscriber-Safe Data Access

The subscriber never sees:
- AI draft content (until letter is in `generated_locked` status for paywall preview)
- Research packets or research runs
- Internal review notes
- Attorney edit versions (only `final_approved` versions)
- Workflow job details

**Safe query function:** `getLetterRequestSafeForSubscriber(id, userId)` — returns only subscriber-safe columns, excludes `currentAiDraftVersionId`, research data, and internal metadata.

**Version access rules** (`versions.get` procedure):
- Subscribers can view `final_approved` versions always
- Subscribers can view `ai_draft` only when letter is `generated_locked` (paywall preview)
- All other version types are forbidden for subscribers
