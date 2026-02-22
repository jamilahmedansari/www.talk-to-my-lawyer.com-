/**
 * Two-stage AI pipeline:
 * Stage 1: Legal research via OpenAI (with web search prompt)
 * Stage 2: Letter drafting via OpenAI based on validated research packet
 *
 * Includes deterministic validators before each stage transition.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { createPatchedFetch } from "./_core/patchedFetch";
import {
  createLetterVersion,
  createResearchRun,
  createWorkflowJob,
  getLatestResearchRun,
  logReviewAction,
  updateLetterStatus,
  updateLetterVersionPointers,
  updateResearchRun,
  updateWorkflowJob,
} from "./db";
import type { IntakeJson, ResearchPacket, DraftOutput } from "../shared/types";

const openai = createOpenAI({
  apiKey: process.env.BUILT_IN_FORGE_API_KEY,
  baseURL: `${process.env.BUILT_IN_FORGE_API_URL}/v1`,
  fetch: createPatchedFetch(fetch),
});

const MODEL = openai.chat("gemini-2.5-flash");

// ═══════════════════════════════════════════════════════
// DETERMINISTIC VALIDATORS
// ═══════════════════════════════════════════════════════

export function validateResearchPacket(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") return { valid: false, errors: ["Research packet is not an object"] };
  const p = data as Record<string, unknown>;
  if (!p.researchSummary || typeof p.researchSummary !== "string" || p.researchSummary.length < 50)
    errors.push("researchSummary must be a non-empty string (min 50 chars)");
  if (!p.jurisdictionProfile || typeof p.jurisdictionProfile !== "object")
    errors.push("jurisdictionProfile is required");
  if (!Array.isArray(p.issuesIdentified) || p.issuesIdentified.length === 0)
    errors.push("issuesIdentified must be a non-empty array");
  if (!Array.isArray(p.applicableRules))
    errors.push("applicableRules must be an array");
  else {
    (p.applicableRules as unknown[]).forEach((rule, i) => {
      if (!rule || typeof rule !== "object") { errors.push(`applicableRules[${i}] is not an object`); return; }
      const r = rule as Record<string, unknown>;
      if (!r.ruleTitle) errors.push(`applicableRules[${i}].ruleTitle is required`);
      if (!r.summary) errors.push(`applicableRules[${i}].summary is required`);
      if (!["high", "medium", "low"].includes(r.confidence as string))
        errors.push(`applicableRules[${i}].confidence must be high/medium/low`);
    });
  }
  if (!Array.isArray(p.draftingConstraints)) errors.push("draftingConstraints must be an array");
  return { valid: errors.length === 0, errors };
}

export function parseAndValidateDraftLlmOutput(raw: string): { valid: boolean; data?: DraftOutput; errors: string[] } {
  const errors: string[] = [];
  // Try to extract JSON from markdown code blocks or raw JSON
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  // Try to find JSON object
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) jsonStr = objMatch[0];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // If not JSON, treat raw text as the letter content
    if (raw.trim().length > 100) {
      return {
        valid: true,
        data: {
          draftLetter: raw.trim(),
          attorneyReviewSummary: "AI-generated draft — please review carefully.",
          openQuestions: [],
          riskFlags: [],
        },
        errors: [],
      };
    }
    return { valid: false, errors: ["Could not parse draft output as JSON or plain text"] };
  }

  if (!parsed || typeof parsed !== "object") return { valid: false, errors: ["Draft output is not an object"] };
  const d = parsed as Record<string, unknown>;
  if (!d.draftLetter || typeof d.draftLetter !== "string" || d.draftLetter.length < 100)
    errors.push("draftLetter must be a non-empty string (min 100 chars)");
  if (!d.attorneyReviewSummary || typeof d.attorneyReviewSummary !== "string")
    errors.push("attorneyReviewSummary is required");
  if (!Array.isArray(d.openQuestions)) errors.push("openQuestions must be an array");
  if (!Array.isArray(d.riskFlags)) errors.push("riskFlags must be an array");

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: parsed as DraftOutput, errors: [] };
}

// ═══════════════════════════════════════════════════════
// STAGE 1: LEGAL RESEARCH
// ═══════════════════════════════════════════════════════

export async function runResearchStage(letterId: number, intake: IntakeJson): Promise<ResearchPacket> {
  const job = await createWorkflowJob({
    letterRequestId: letterId,
    jobType: "research",
    provider: "openai",
    requestPayloadJson: { letterId, letterType: intake.letterType, jurisdiction: intake.jurisdiction },
  });
  const jobId = (job as any)?.insertId ?? 0;

  const researchRun = await createResearchRun({
    letterRequestId: letterId,
    workflowJobId: jobId,
    provider: "openai",
  });
  const runId = (researchRun as any)?.insertId ?? 0;

  await updateWorkflowJob(jobId, { status: "running", startedAt: new Date() });
  await updateResearchRun(runId, { status: "running" });
  await updateLetterStatus(letterId, "researching");

  const prompt = buildResearchPrompt(intake);

  try {
    const { text } = await generateText({ model: MODEL, prompt, maxOutputTokens: 4000 });

    // Parse research packet from response
    let researchPacket: ResearchPacket;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      researchPacket = JSON.parse(jsonStr);
    } catch {
      // Build a structured packet from the text response
      researchPacket = {
        researchSummary: text.substring(0, 500),
        jurisdictionProfile: {
          country: intake.jurisdiction.country,
          stateProvince: intake.jurisdiction.state,
          city: intake.jurisdiction.city,
          authorityHierarchy: ["Federal", "State", "Local"],
        },
        issuesIdentified: [intake.matter.description.substring(0, 200)],
        applicableRules: [],
        localJurisdictionElements: [],
        factualDataNeeded: [],
        openQuestions: [],
        riskFlags: [],
        draftingConstraints: [],
      };
    }

    // Deterministic validation
    const validation = validateResearchPacket(researchPacket);
    if (!validation.valid) {
      await updateResearchRun(runId, {
        status: "invalid",
        resultJson: researchPacket,
        validationResultJson: { errors: validation.errors },
        errorMessage: `Validation failed: ${validation.errors.join("; ")}`,
      });
      await updateWorkflowJob(jobId, {
        status: "failed",
        errorMessage: `Research validation failed: ${validation.errors.join("; ")}`,
        completedAt: new Date(),
      });
      throw new Error(`Research packet validation failed: ${validation.errors.join("; ")}`);
    }

    await updateResearchRun(runId, {
      status: "completed",
      resultJson: researchPacket,
      validationResultJson: { valid: true, errors: [] },
    });
    await updateWorkflowJob(jobId, { status: "completed", completedAt: new Date(), responsePayloadJson: { researchRunId: runId } });

    return researchPacket;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateResearchRun(runId, { status: "failed", errorMessage: msg });
    await updateWorkflowJob(jobId, { status: "failed", errorMessage: msg, completedAt: new Date() });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// STAGE 2: LETTER DRAFTING
// ═══════════════════════════════════════════════════════

export async function runDraftingStage(letterId: number, intake: IntakeJson, research: ResearchPacket): Promise<DraftOutput> {
  const job = await createWorkflowJob({
    letterRequestId: letterId,
    jobType: "draft_generation",
    provider: "openai",
    requestPayloadJson: { letterId, letterType: intake.letterType },
  });
  const jobId = (job as any)?.insertId ?? 0;

  await updateWorkflowJob(jobId, { status: "running", startedAt: new Date() });
  await updateLetterStatus(letterId, "drafting");

  const prompt = buildDraftingPrompt(intake, research);

  try {
    const { text } = await generateText({ model: MODEL, prompt, maxOutputTokens: 6000 });

    const validation = parseAndValidateDraftLlmOutput(text);
    if (!validation.valid || !validation.data) {
      await updateWorkflowJob(jobId, {
        status: "failed",
        errorMessage: `Draft validation failed: ${validation.errors.join("; ")}`,
        completedAt: new Date(),
      });
      throw new Error(`Draft output validation failed: ${validation.errors.join("; ")}`);
    }

    const draft = validation.data;

    // Store AI draft as a letter version
    const version = await createLetterVersion({
      letterRequestId: letterId,
      versionType: "ai_draft",
      content: draft.draftLetter,
      createdByType: "system",
      metadataJson: {
        attorneyReviewSummary: draft.attorneyReviewSummary,
        openQuestions: draft.openQuestions,
        riskFlags: draft.riskFlags,
      },
    });
    const versionId = (version as any)?.insertId ?? 0;

    await updateLetterVersionPointers(letterId, { currentAiDraftVersionId: versionId });
    await updateWorkflowJob(jobId, { status: "completed", completedAt: new Date(), responsePayloadJson: { versionId } });
    await updateLetterStatus(letterId, "pending_review");

    await logReviewAction({
      letterRequestId: letterId,
      actorType: "system",
      action: "ai_draft_completed",
      noteText: `AI draft generated. Review summary: ${draft.attorneyReviewSummary}`,
      fromStatus: "drafting",
      toStatus: "pending_review",
    });

    return draft;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateWorkflowJob(jobId, { status: "failed", errorMessage: msg, completedAt: new Date() });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// FULL PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════

export async function runFullPipeline(letterId: number, intake: IntakeJson): Promise<void> {
  const pipelineJob = await createWorkflowJob({
    letterRequestId: letterId,
    jobType: "generation_pipeline",
    provider: "openai",
    requestPayloadJson: { letterId },
  });
  const pipelineJobId = (pipelineJob as any)?.insertId ?? 0;
  await updateWorkflowJob(pipelineJobId, { status: "running", startedAt: new Date() });

  try {
    // Stage 1: Research
    const research = await runResearchStage(letterId, intake);
    // Stage 2: Draft
    await runDraftingStage(letterId, intake, research);
    await updateWorkflowJob(pipelineJobId, { status: "completed", completedAt: new Date() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateWorkflowJob(pipelineJobId, { status: "failed", errorMessage: msg, completedAt: new Date() });
    await updateLetterStatus(letterId, "submitted"); // revert to allow retry
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// RETRY LOGIC
// ═══════════════════════════════════════════════════════

export async function retryPipelineFromStage(
  letterId: number,
  intake: IntakeJson,
  stage: "research" | "drafting"
): Promise<void> {
  const retryJob = await createWorkflowJob({
    letterRequestId: letterId,
    jobType: "retry",
    provider: "openai",
    requestPayloadJson: { letterId, stage },
  });
  const retryJobId = (retryJob as any)?.insertId ?? 0;
  await updateWorkflowJob(retryJobId, { status: "running", startedAt: new Date() });

  try {
    if (stage === "research") {
      const research = await runResearchStage(letterId, intake);
      await runDraftingStage(letterId, intake, research);
    } else {
      const latestResearch = await getLatestResearchRun(letterId);
      if (!latestResearch?.resultJson) throw new Error("No completed research run found for retry");
      await runDraftingStage(letterId, intake, latestResearch.resultJson as ResearchPacket);
    }
    await updateWorkflowJob(retryJobId, { status: "completed", completedAt: new Date() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateWorkflowJob(retryJobId, { status: "failed", errorMessage: msg, completedAt: new Date() });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════

function buildResearchPrompt(intake: IntakeJson): string {
  return `You are a senior legal research specialist. Research the applicable laws, statutes, and regulations for the following legal matter and produce a structured JSON research packet.

## Legal Matter
- Type: ${intake.letterType}
- Subject: ${intake.matter.subject}
- Description: ${intake.matter.description}
- Jurisdiction: ${intake.jurisdiction.state}, ${intake.jurisdiction.country}
- Desired Outcome: ${intake.desiredOutcome}

## Required Output Format
Return ONLY a valid JSON object with this exact structure:
\`\`\`json
{
  "researchSummary": "2-3 paragraph summary of the legal landscape",
  "jurisdictionProfile": {
    "country": "${intake.jurisdiction.country}",
    "stateProvince": "${intake.jurisdiction.state}",
    "city": "${intake.jurisdiction.city ?? ""}",
    "authorityHierarchy": ["Federal", "State", "Local"]
  },
  "issuesIdentified": ["Issue 1", "Issue 2"],
  "applicableRules": [
    {
      "ruleTitle": "Rule name",
      "ruleType": "statute|regulation|case_law|common_law",
      "jurisdiction": "${intake.jurisdiction.state}",
      "citationText": "Citation",
      "sectionOrRule": "Section number",
      "summary": "Plain English summary",
      "sourceUrl": "URL if known",
      "sourceTitle": "Source name",
      "relevance": "Why this applies",
      "confidence": "high|medium|low"
    }
  ],
  "localJurisdictionElements": [
    {
      "element": "Local rule or requirement",
      "whyItMatters": "Explanation",
      "sourceUrl": "URL if known",
      "confidence": "high|medium|low"
    }
  ],
  "factualDataNeeded": ["What additional facts are needed"],
  "openQuestions": ["Legal questions that need clarification"],
  "riskFlags": ["Potential legal risks or complications"],
  "draftingConstraints": ["Specific requirements for the letter draft"]
}
\`\`\``;
}

function buildDraftingPrompt(intake: IntakeJson, research: ResearchPacket): string {
  return `You are a senior attorney drafting a professional legal letter. Use the research packet below to draft a legally sound, persuasive letter.

## Intake Information
- Letter Type: ${intake.letterType}
- Sender: ${intake.sender.name}, ${intake.sender.address}
- Recipient: ${intake.recipient.name}, ${intake.recipient.address}
- Subject: ${intake.matter.subject}
- Facts: ${intake.matter.description}
- Desired Outcome: ${intake.desiredOutcome}
- Deadline: ${intake.deadlineDate ?? "Not specified"}
- Tone: ${intake.tonePreference ?? "firm"}

## Research Packet
${JSON.stringify(research, null, 2)}

## Required Output Format
Return ONLY a valid JSON object:
\`\`\`json
{
  "draftLetter": "Full formal letter text with proper formatting, legal citations, and professional tone. Include date, addresses, subject line, salutation, body paragraphs, closing, and signature block.",
  "attorneyReviewSummary": "Summary of key legal points, citations used, and areas requiring attorney attention",
  "openQuestions": ["Questions for the attorney reviewer"],
  "riskFlags": ["Legal risks or issues the attorney should verify"]
}
\`\`\`

The letter must:
1. Reference specific statutes and regulations from the research packet
2. State the legal basis for the claim clearly
3. Make a specific demand with a deadline
4. Include appropriate legal language for a ${intake.letterType}
5. Be professionally formatted`;
}
