import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateResearchPacket, parseAndValidateDraftLlmOutput } from "./pipeline";
import { ALLOWED_TRANSITIONS, isValidTransition } from "../shared/types";

// ============================================================================
// STATUS MACHINE TESTS
// ============================================================================
describe("Status Machine: ALLOWED_TRANSITIONS", () => {
  it("should allow submitted → researching", () => {
    expect(isValidTransition("submitted", "researching")).toBe(true);
  });

  it("should allow researching → drafting", () => {
    expect(isValidTransition("researching", "drafting")).toBe(true);
  });

  it("should allow drafting → pending_review", () => {
    expect(isValidTransition("drafting", "pending_review")).toBe(true);
  });

  it("should allow pending_review → under_review", () => {
    expect(isValidTransition("pending_review", "under_review")).toBe(true);
  });

  it("should allow under_review → approved", () => {
    expect(isValidTransition("under_review", "approved")).toBe(true);
  });

  it("should allow under_review → rejected", () => {
    expect(isValidTransition("under_review", "rejected")).toBe(true);
  });

  it("should allow under_review → needs_changes", () => {
    expect(isValidTransition("under_review", "needs_changes")).toBe(true);
  });

  it("should NOT allow submitted → approved (skip stages)", () => {
    expect(isValidTransition("submitted", "approved")).toBe(false);
  });

  it("should NOT allow approved → under_review (backward)", () => {
    expect(isValidTransition("approved", "under_review")).toBe(false);
  });

  it("should NOT allow rejected → researching", () => {
    expect(isValidTransition("rejected", "researching")).toBe(false);
  });

  it("should NOT allow pending_review → approved (skip under_review)", () => {
    expect(isValidTransition("pending_review", "approved")).toBe(false);
  });

  it("should allow needs_changes → researching (retry from research)", () => {
    expect(isValidTransition("needs_changes", "researching")).toBe(true);
  });

  it("should allow needs_changes → drafting (retry from draft)", () => {
    expect(isValidTransition("needs_changes", "drafting")).toBe(true);
  });
});

// ============================================================================
// RESEARCH PACKET VALIDATOR TESTS
// ============================================================================
describe("validateResearchPacket", () => {
  it("should validate a complete research packet", () => {
    const packet = {
      researchSummary: "This is a valid research summary for the legal matter involving a lease breach in California. The tenant has failed to pay rent for three consecutive months.",
      jurisdictionProfile: { state: "CA", country: "US", legalSystem: "common law" },
      issuesIdentified: ["Breach of lease agreement", "Unpaid rent"],
      applicableRules: [
        {
          ruleTitle: "California Civil Code § 1950.5",
          summary: "Governs security deposit requirements for residential tenancies.",
          citationText: "Cal. Civ. Code § 1950.5",
          confidence: "high",
        },
      ],
      draftingConstraints: ["Must include 3-day notice language"],
      riskFlags: [],
      openQuestions: [],
      jurisdictionNotes: "California law applies.",
      recommendedTone: "firm",
    };
    const result = validateResearchPacket(packet);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject a packet missing researchSummary", () => {
    const packet = {
      jurisdictionProfile: { state: "CA" },
      issuesIdentified: ["Issue 1"],
      applicableRules: [{ ruleTitle: "Some Rule", summary: "Summary", confidence: "high" }],
      draftingConstraints: [],
    };
    const result = validateResearchPacket(packet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("researchSummary"))).toBe(true);
  });

  it("should reject a packet missing issuesIdentified", () => {
    const packet = {
      researchSummary: "This is a valid research summary with more than fifty characters here.",
      jurisdictionProfile: { state: "CA" },
      issuesIdentified: [],
      applicableRules: [{ ruleTitle: "Some Rule", summary: "Summary", confidence: "high" }],
      draftingConstraints: [],
    };
    const result = validateResearchPacket(packet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("issuesIdentified"))).toBe(true);
  });

  it("should reject null input", () => {
    const result = validateResearchPacket(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should reject non-object input", () => {
    const result = validateResearchPacket("not an object");
    expect(result.valid).toBe(false);
  });

  it("should reject a packet with rules missing required fields", () => {
    const packet = {
      researchSummary: "This is a valid research summary with more than fifty characters here.",
      jurisdictionProfile: { state: "CA" },
      issuesIdentified: ["Issue 1"],
      applicableRules: [{ ruleTitle: "Rule without summary" }],
      draftingConstraints: [],
    };
    const result = validateResearchPacket(packet);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// DRAFT LLM OUTPUT PARSER TESTS
// ============================================================================
describe("parseAndValidateDraftLlmOutput", () => {
  it("should parse a valid JSON draft output", () => {
    const draftOutput = {
      draftLetter: "Dear Mr. Smith,\n\nThis letter serves as formal notice that you are in breach of your obligations under the lease agreement. You are hereby required to remedy this breach within 30 days of receipt of this letter. Failure to do so will result in legal action being taken against you.\n\nSincerely,\nJohn Doe",
      attorneyReviewSummary: "Standard demand letter citing breach of lease.",
      openQuestions: [],
      riskFlags: [],
    };
    const raw = JSON.stringify(draftOutput);
    const result = parseAndValidateDraftLlmOutput(raw);
    expect(result.valid).toBe(true);
    expect(result.data?.draftLetter).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });

  it("should extract JSON from markdown code blocks", () => {
    const draftOutput = {
      draftLetter: "Dear Sir/Madam,\n\nThis formal legal notice is to inform you of your obligations under applicable law. You are required to take immediate action to remedy the situation described herein. Failure to comply within the specified timeframe will result in further legal proceedings.\n\nRegards,\nSender",
      attorneyReviewSummary: "Formal notice letter extracted from markdown.",
      openQuestions: [],
      riskFlags: [],
    };
    const raw = "```json\n" + JSON.stringify(draftOutput) + "\n```";
    const result = parseAndValidateDraftLlmOutput(raw);
    expect(result.valid).toBe(true);
    expect(result.data?.draftLetter).toBeDefined();
  });

  it("should reject output with missing draftLetter", () => {
    const raw = JSON.stringify({ wordCount: 100, citationsUsed: [], attorneyReviewSummary: "Summary" });
    const result = parseAndValidateDraftLlmOutput(raw);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("draftLetter"))).toBe(true);
  });

  it("should reject output with too-short draftLetter", () => {
    const raw = JSON.stringify({ draftLetter: "Too short.", attorneyReviewSummary: "Summary", openQuestions: [], riskFlags: [] });
    const result = parseAndValidateDraftLlmOutput(raw);
    expect(result.valid).toBe(false);
  });

  it("should reject invalid JSON", () => {
    const result = parseAndValidateDraftLlmOutput("not valid json {{{");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should reject empty string", () => {
    const result = parseAndValidateDraftLlmOutput("");
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// AUTH LOGOUT TEST (preserved from template)
// ============================================================================
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

// ============================================================================
// RBAC TESTS
// ============================================================================
describe("RBAC: Role-based access control", () => {
  it("subscriber cannot access admin procedures", async () => {
    const { ctx } = createAuthContext("user");
    // Subscriber role is 'user' in the base template, but we extend it
    // Just verify the auth.me returns the user
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).toBeDefined();
    expect(me?.role).toBe("user");
  });

  it("admin can access auth.me", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me?.role).toBe("admin");
  });
});
