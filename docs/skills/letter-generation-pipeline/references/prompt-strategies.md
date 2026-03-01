# Prompt Strategies Reference

## Table of Contents
- [Stage 1: Research Prompt](#stage-1-research-prompt)
- [Stage 2: Drafting Prompt](#stage-2-drafting-prompt)
- [Stage 3: Assembly Prompt](#stage-3-assembly-prompt)
- [JSON Extraction Pattern](#json-extraction-pattern)
- [Model Configuration](#model-configuration)

---

## Stage 1: Research Prompt

**File:** `server/pipeline.ts` → `buildResearchPrompt()`

### System Message
The research prompt uses a system message that establishes the AI as a legal research assistant. It instructs the model to:
- Focus on the specific jurisdiction (state + country)
- Search for applicable statutes, regulations, and case law
- Identify local filing requirements and deadlines
- Flag risk areas and open questions

### User Message Structure
```
LEGAL RESEARCH REQUEST
======================
Letter Type: {letterType}
Jurisdiction: {state}, {country}
Matter Category: {matterCategory}

SENDER INFORMATION:
{sender details}

RECIPIENT INFORMATION:
{recipient details}

MATTER DETAILS:
Subject: {subject}
Description: {description}
Incident Date: {incidentDate}

FINANCIAL DETAILS:
{financials if present}

DESIRED OUTCOME:
{desiredOutcome}

DEADLINE:
{deadlineDate}

PRIOR COMMUNICATIONS:
{priorCommunication}

ADDITIONAL CONTEXT:
{additionalContext}

OUTPUT FORMAT:
Return a JSON object matching the ResearchPacket schema...
```

### Key Prompt Instructions
- Must cite specific statutes with section numbers
- Must include source URLs for all citations
- Must rate confidence (high/medium/low) for each rule
- Must identify jurisdiction-specific requirements
- Must flag any statute of limitations concerns
- Must list factual data still needed from the client

---

## Stage 2: Drafting Prompt

**File:** `server/pipeline.ts` → `buildDraftingPrompt()`

### System Message
Establishes the AI as a legal letter drafting specialist. Instructs:
- Use formal legal correspondence format
- Incorporate research findings and citations
- Match the requested tone (firm/moderate/aggressive)
- Structure with clear demands and deadlines

### User Message Structure
```
LEGAL LETTER DRAFTING REQUEST
==============================
Letter Type: {letterType}
Tone: {tonePreference}
Language: {language}
Delivery Method: {deliveryMethod}

INTAKE DATA:
{full normalized intake JSON}

RESEARCH FINDINGS:
{full ResearchPacket JSON}

INSTRUCTIONS:
1. Draft a complete legal letter incorporating the research
2. Include proper legal citations from the research packet
3. Structure: salutation, background, legal basis, demands, deadline, closing
4. Flag any areas requiring attorney attention
5. Note open questions and risk flags

OUTPUT FORMAT:
Return a JSON object matching the DraftOutput schema...
```

### Tone Calibration
- **Firm:** Professional, direct, clear demands with legal backing
- **Moderate:** Balanced, seeks resolution while preserving legal rights
- **Aggressive:** Strong language, emphasizes consequences, tight deadlines

---

## Stage 3: Assembly Prompt

**File:** `server/pipeline.ts` → `buildAssemblyPrompt()`

### System Message
Establishes the AI as a legal document finalizer. Instructs:
- Polish and format the draft into a professional legal letter
- Ensure all citations are properly formatted
- Add appropriate disclaimers
- Format for print-ready output

### User Message Structure
```
LEGAL LETTER FINAL ASSEMBLY
============================
INTAKE SUMMARY:
{key intake fields}

RESEARCH HIGHLIGHTS:
{key research findings, applicable rules}

DRAFT LETTER:
{full draft from Stage 2}

ATTORNEY REVIEW NOTES:
{attorneyReviewSummary from Stage 2}

OPEN QUESTIONS:
{openQuestions from Stage 2}

RISK FLAGS:
{riskFlags from Stage 2}

INSTRUCTIONS:
1. Polish the draft into final form
2. Ensure proper legal letter format
3. Verify all citations are accurate and properly formatted
4. Add standard legal disclaimers
5. Output the complete letter text ready for PDF generation
```

---

## JSON Extraction Pattern

All stages use a common JSON extraction pattern for parsing AI responses:

```typescript
// pipeline.ts uses this pattern:
function extractJson(text: string): object {
  // 1. Try to find JSON in code blocks (```json ... ```)
  // 2. Try to find JSON between { and }
  // 3. Try to parse the entire response as JSON
  // 4. Throw if no valid JSON found
}
```

The extraction is fault-tolerant:
- Strips markdown code fences
- Handles trailing commas
- Handles comments in JSON
- Falls back to regex extraction if standard parse fails

---

## Model Configuration

### Perplexity (Stage 1)
```typescript
{
  model: "sonar-pro",
  temperature: 0.1,      // Low for factual accuracy
  max_tokens: 8000,
  timeout: 90_000,        // 90 seconds
}
```
Client: OpenAI-compatible SDK with `baseURL: "https://api.perplexity.ai"`

### Anthropic (Stages 2 & 3)
```typescript
{
  model: "claude-opus-4-5",
  max_tokens: 8000,
  temperature: 0.3,      // Slightly higher for creative drafting
  timeout: 120_000,       // 120 seconds
}
```
Client: Anthropic SDK (`@anthropic-ai/sdk`)

### Fallback Research (When Perplexity unavailable)
Uses Anthropic Claude with the same research prompt but without web search grounding. Less accurate for current statutes but functional.
