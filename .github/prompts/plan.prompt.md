---
name: plan
description: Build a deep audit plan with the Plan agent
agent: Plan
argument-hint: Describe the audit scope, priorities, and constraints
---
Create a rigorous, execution-ready audit plan for the requested scope.

Your job is to design a **file-by-file verification plan** that checks both frontend and backend implementation quality, correctness, and completeness.

Use the user request as the scope and produce a plan that can uncover:
- missing functionality and implementation gaps
- edge cases not handled
- logic bugs and error-handling flaws
- API/contract mismatches across layers
- state, auth, role, and permission inconsistencies
- validation, schema, and type-safety issues
- UI behavior mismatches vs expected flows
- performance and reliability risks

Plan requirements:
1. Break work into clear phases (discovery → mapping → verification → synthesis).
2. Include a concrete file traversal strategy (group by domain, then file-by-file).
3. Define checks for frontend and backend separately, then integration checks.
4. Require evidence for each finding (file path, symbol, behavior, impact).
5. Prioritize findings by severity (Critical/High/Medium/Low) and confidence.
6. Include edge-case test ideas and failure scenarios for each major flow.
7. Explicitly call out assumptions, unknowns, and follow-up questions.
8. End with a remediation roadmap (quick wins, high-impact fixes, hardening).

Output format:
- Scope summary
- Audit phases with ordered steps
- File-by-file checklist template
- Frontend checks
- Backend checks
- Cross-layer/integration checks
- Edge-case matrix
- Risk scoring model
- Deliverables and final report structure

Be meticulous, practical, and specific. Avoid generic advice.
