import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── User Roles ───
export const USER_ROLES = ["subscriber", "employee", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ─── Letter Statuses (State Machine) ───
export const LETTER_STATUSES = [
  "submitted",
  "researching",
  "drafting",
  "pending_review",
  "under_review",
  "needs_changes",
  "approved",
  "rejected",
] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

// ─── Letter Types ───
export const LETTER_TYPES = [
  "demand-letter",
  "cease-and-desist",
  "contract-breach",
  "eviction-notice",
  "employment-dispute",
  "consumer-complaint",
  "general-legal",
] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

// ─── Version Types ───
export const VERSION_TYPES = ["ai_draft", "attorney_edit", "final_approved"] as const;
export type VersionType = (typeof VERSION_TYPES)[number];

// ─── Actor Types ───
export const ACTOR_TYPES = ["system", "subscriber", "employee", "admin"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

// ─── Job Statuses ───
export const JOB_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// ─── Job Types ───
export const JOB_TYPES = ["research", "draft_generation", "generation_pipeline", "retry"] as const;
export type JobType = (typeof JOB_TYPES)[number];

// ─── Research Statuses ───
export const RESEARCH_STATUSES = ["queued", "running", "completed", "failed", "invalid"] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

// ─── Priority Levels ───
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

// ═══════════════════════════════════════════════════════
// TABLE: users
// ═══════════════════════════════════════════════════════
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["subscriber", "employee", "admin"]).default("subscriber").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ═══════════════════════════════════════════════════════
// TABLE: letter_requests
// ═══════════════════════════════════════════════════════
export const letterRequests = mysqlTable("letter_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  letterType: mysqlEnum("letterType", [
    "demand-letter",
    "cease-and-desist",
    "contract-breach",
    "eviction-notice",
    "employment-dispute",
    "consumer-complaint",
    "general-legal",
  ]).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  issueSummary: text("issueSummary"),
  jurisdictionCountry: varchar("jurisdictionCountry", { length: 100 }).default("US"),
  jurisdictionState: varchar("jurisdictionState", { length: 100 }),
  jurisdictionCity: varchar("jurisdictionCity", { length: 200 }),
  intakeJson: json("intakeJson"),
  status: mysqlEnum("status", [
    "submitted",
    "researching",
    "drafting",
    "pending_review",
    "under_review",
    "needs_changes",
    "approved",
    "rejected",
  ]).default("submitted").notNull(),
  assignedReviewerId: int("assignedReviewerId"),
  currentAiDraftVersionId: int("currentAiDraftVersionId"),
  currentFinalVersionId: int("currentFinalVersionId"),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  lastStatusChangedAt: timestamp("lastStatusChangedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LetterRequest = typeof letterRequests.$inferSelect;
export type InsertLetterRequest = typeof letterRequests.$inferInsert;

// ═══════════════════════════════════════════════════════
// TABLE: letter_versions (immutable version history)
// ═══════════════════════════════════════════════════════
export const letterVersions = mysqlTable("letter_versions", {
  id: int("id").autoincrement().primaryKey(),
  letterRequestId: int("letterRequestId").notNull(),
  versionType: mysqlEnum("versionType", ["ai_draft", "attorney_edit", "final_approved"]).notNull(),
  content: text("content").notNull(),
  createdByType: mysqlEnum("createdByType", ["system", "subscriber", "employee", "admin"]).notNull(),
  createdByUserId: int("createdByUserId"),
  metadataJson: json("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LetterVersion = typeof letterVersions.$inferSelect;
export type InsertLetterVersion = typeof letterVersions.$inferInsert;

// ═══════════════════════════════════════════════════════
// TABLE: review_actions (audit trail)
// ═══════════════════════════════════════════════════════
export const reviewActions = mysqlTable("review_actions", {
  id: int("id").autoincrement().primaryKey(),
  letterRequestId: int("letterRequestId").notNull(),
  reviewerId: int("reviewerId"),
  actorType: mysqlEnum("actorType", ["system", "subscriber", "employee", "admin"]).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  noteText: text("noteText"),
  noteVisibility: mysqlEnum("noteVisibility", ["internal", "user_visible"]).default("internal"),
  fromStatus: varchar("fromStatus", { length: 50 }),
  toStatus: varchar("toStatus", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReviewAction = typeof reviewActions.$inferSelect;
export type InsertReviewAction = typeof reviewActions.$inferInsert;

// ═══════════════════════════════════════════════════════
// TABLE: workflow_jobs (pipeline execution logging)
// ═══════════════════════════════════════════════════════
export const workflowJobs = mysqlTable("workflow_jobs", {
  id: int("id").autoincrement().primaryKey(),
  letterRequestId: int("letterRequestId").notNull(),
  jobType: mysqlEnum("jobType", ["research", "draft_generation", "generation_pipeline", "retry"]).notNull(),
  provider: varchar("provider", { length: 50 }),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).default("queued").notNull(),
  attemptCount: int("attemptCount").default(0),
  errorMessage: text("errorMessage"),
  requestPayloadJson: json("requestPayloadJson"),
  responsePayloadJson: json("responsePayloadJson"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowJob = typeof workflowJobs.$inferSelect;
export type InsertWorkflowJob = typeof workflowJobs.$inferInsert;

// ═══════════════════════════════════════════════════════
// TABLE: research_runs
// ═══════════════════════════════════════════════════════
export const researchRuns = mysqlTable("research_runs", {
  id: int("id").autoincrement().primaryKey(),
  letterRequestId: int("letterRequestId").notNull(),
  workflowJobId: int("workflowJobId"),
  provider: varchar("provider", { length: 50 }).default("perplexity"),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "invalid"]).default("queued").notNull(),
  queryPlanJson: json("queryPlanJson"),
  resultJson: json("resultJson"),
  validationResultJson: json("validationResultJson"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResearchRun = typeof researchRuns.$inferSelect;
export type InsertResearchRun = typeof researchRuns.$inferInsert;

// ═══════════════════════════════════════════════════════
// TABLE: attachments
// ═══════════════════════════════════════════════════════
export const attachments = mysqlTable("attachments", {
  id: int("id").autoincrement().primaryKey(),
  letterRequestId: int("letterRequestId").notNull(),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  storagePath: varchar("storagePath", { length: 1000 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 2000 }),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 200 }),
  sizeBytes: bigint("sizeBytes", { mode: "number" }),
  metadataJson: json("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

// ═══════════════════════════════════════════════════════
// TABLE: notifications
// ═══════════════════════════════════════════════════════
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 1000 }),
  readAt: timestamp("readAt"),
  metadataJson: json("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
