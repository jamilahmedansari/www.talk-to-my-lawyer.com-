# Data Shapes Reference

> **⚠️ Schema Changes:** All schema changes must be applied via Drizzle migrations. Follow the `drizzle/migrations/000X_description.sql` naming convention.

## Table of Contents
- [IntakeJson](#intakejson)
- [NormalizedPromptInput](#normalizedpromptinput)
- [ResearchPacket](#researchpacket)
- [DraftOutput](#draftoutput)
- [Letter Request (DB Row)](#letter-request-db-row)
- [Letter Version (DB Row)](#letter-version-db-row)
- [Workflow Job (DB Row)](#workflow-job-db-row)

---

## IntakeJson

Source: `shared/types.ts`

The raw intake form data submitted by the subscriber. Stored as JSONB in `letter_requests.intakeJson`.

```typescript
interface IntakeJson {
  schemaVersion: string;
  letterType: string;
  sender: {
    name: string;
    address: string;
    email?: string;
    phone?: string;
  };
  recipient: {
    name: string;
    address: string;
    email?: string;
    phone?: string;
  };
  jurisdiction: {
    country: string;
    state: string;
    city?: string;
  };
  matter: {
    category: string;
    subject: string;
    description: string;
    incidentDate?: string;
  };
  financials?: {
    amountOwed?: number;
    currency?: string;
  };
  desiredOutcome: string;
  deadlineDate?: string;
  additionalContext?: string;
  tonePreference?: "firm" | "moderate" | "aggressive";
  language?: string;
  priorCommunication?: string;
  deliveryMethod?: string;
  communications?: {
    summary: string;
    lastContactDate?: string;
    method?: "email" | "phone" | "letter" | "in-person" | "other";
  };
  toneAndDelivery?: {
    tone: "firm" | "moderate" | "aggressive";
    deliveryMethod?: "email" | "certified-mail" | "hand-delivery";
  };
}
```

---

## NormalizedPromptInput

Source: `server/intake-normalizer.ts`

Canonical normalized form of intake data. All AI prompt builders use this shape.

```typescript
interface NormalizedPromptInput {
  schemaVersion: string;
  letterType: string;
  matterCategory: string;
  sender: {
    name: string;       // default: "Unknown Sender"
    address: string;    // default: "Address not provided"
    email: string | null;
    phone: string | null;
  };
  recipient: {
    name: string;       // default: "Unknown Recipient"
    address: string;    // default: "Address not provided"
    email: string | null;
    phone: string | null;
  };
  jurisdiction: {
    country: string;    // default: "US"
    state: string;      // default: "Unknown"
    city: string | null;
  };
  matter: {
    category: string;
    subject: string;
    description: string;
    incidentDate: string | null;
  };
  financials: {
    amountOwed: number | null;
    currency: string;   // default: "USD"
  } | null;
  desiredOutcome: string;       // default: "Resolution of the matter"
  deadlineDate: string | null;
  additionalContext: string | null;
  tonePreference: "firm" | "moderate" | "aggressive"; // default: "firm"
  language: string;             // default: "english"
  priorCommunication: string | null;
  deliveryMethod: string;       // default: "certified_mail"
  timeline: string[];
  evidenceSummary: string | null;
  userStatements: string | null;
}
```

---

## ResearchPacket

Source: `shared/types.ts`

Output of Stage 1 (research). Consumed by Stage 2 (drafting) and Stage 3 (assembly).

```typescript
interface ResearchPacket {
  researchSummary: string;
  jurisdictionProfile: {
    country: string;
    stateProvince: string;
    city?: string;
    authorityHierarchy: string[];
  };
  issuesIdentified: string[];
  applicableRules: {
    ruleTitle: string;
    ruleType: string;
    jurisdiction: string;
    citationText: string;
    sectionOrRule: string;
    summary: string;
    sourceUrl: string;
    sourceTitle: string;
    relevance: string;
    confidence: "high" | "medium" | "low";
  }[];
  localJurisdictionElements: {
    element: string;
    whyItMatters: string;
    sourceUrl: string;
    confidence: "high" | "medium" | "low";
  }[];
  factualDataNeeded: string[];
  openQuestions: string[];
  riskFlags: string[];
  draftingConstraints: string[];
}
```

---

## DraftOutput

Source: `shared/types.ts`

Output of Stage 2 (drafting). Consumed by Stage 3 (assembly).

```typescript
interface DraftOutput {
  draftLetter: string;
  attorneyReviewSummary: string;
  openQuestions: string[];
  riskFlags: string[];
}
```

---

## Letter Request (DB Row)

Source: `drizzle/schema.ts` → `letterRequests` table

```typescript
// Key columns relevant to pipeline
{
  id: serial;                          // Auto-increment PK
  userId: integer;                     // FK → users.id
  letterType: letterTypeEnum;          // demand-letter, cease-and-desist, etc.
  subject: varchar(500);
  issueSummary: text;
  jurisdictionCountry: varchar(10);    // default: "US"
  jurisdictionState: varchar(100);
  jurisdictionCity: varchar(200);
  intakeJson: jsonb;                   // Full IntakeJson
  status: letterStatusEnum;            // submitted → ... → approved
  priority: priorityEnum;             // low, normal, high, urgent
  currentAiDraftVersionId: integer;    // FK → letter_versions.id
  currentFinalVersionId: integer;      // FK → letter_versions.id
  assignedReviewerId: integer;         // FK → users.id
  pdfUrl: text;                        // S3 URL of approved PDF
  archivedAt: timestamp;               // Soft delete
  lastStatusChangedAt: timestamp;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

---

## Letter Version (DB Row)

Source: `drizzle/schema.ts` → `letterVersions` table

```typescript
{
  id: serial;
  letterRequestId: integer;            // FK → letter_requests.id
  versionType: versionTypeEnum;        // ai_draft | attorney_edit | final_approved
  content: text;                       // The letter content
  createdByType: actorTypeEnum;        // system | subscriber | employee | admin | attorney
  createdByUserId: integer;            // nullable
  metadataJson: jsonb;                 // Stage info, provider, research summary, etc.
  createdAt: timestamp;
}
```

---

## Workflow Job (DB Row)

Source: `drizzle/schema.ts` → `workflowJobs` table

```typescript
{
  id: serial;
  letterRequestId: integer;
  jobType: varchar(100);               // research | drafting | assembly
  status: varchar(50);                 // queued | running | completed | failed
  provider: varchar(100);              // perplexity | anthropic | n8n
  inputPayload: jsonb;
  outputPayload: jsonb;
  errorMessage: text;
  startedAt: timestamp;
  completedAt: timestamp;
  createdAt: timestamp;
}
```

---

## Agent Init (Required)

For any agent task using these data shapes, load the active frontend issue register (`agentId: a28925291b7edfefb`) before implementation.

- First-pass priorities: type-safe interfaces (remove unsafe casts), verified-email contract typing across backend/frontend, and explicit upload/localStorage failure handling.
- Follow-up priorities: auth effect races, debounce-heavy draft persistence, suspense error boundaries, and status/polling consistency.
- Quality pass: accessibility, pagination, optimistic updates, config-driven assets, and production-safe logging.
