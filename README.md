# Talk to My Lawyer

A full-stack legal letter generation and review platform powered by AI. Users submit intake forms, AI generates legal letters through a 3-stage pipeline (research → draft → assembly), attorneys review and approve, and subscribers download polished PDFs.

**Status:** Production-ready ✅ | **Last Updated:** 2026-03-04

---

## Documentation Index

| Document | Purpose |
| --- | --- |
| **[PROJECT_TODO.md](PROJECT_TODO.md)** | **🎯 Centralized TODO tracker** — shared across all coding agents |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Complete codebase mapping — server, database, client, data flows |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Developer guide — setup, code style, testing, deployment |
| **[.github/copilot-instructions.md](.github/copilot-instructions.md)** | GitHub Copilot coding conventions and project patterns |
| **[docs/skills/letter-generation-pipeline/](docs/skills/letter-generation-pipeline/)** | Canonical spec for 3-stage AI pipeline |
| **[docs/skills/letter-review-pipeline/](docs/skills/letter-review-pipeline/)** | Canonical spec for attorney review workflow |
| **[docs/PIPELINE_ARCHITECTURE.md](docs/PIPELINE_ARCHITECTURE.md)** | Pipeline routing (Perplexity → Claude active, n8n dormant) |
| **[docs/CENTRALIZED_MCP_ACCESS.md](docs/CENTRALIZED_MCP_ACCESS.md)** | MCP config for Copilot, Claude Code, and Codex |
| **[docs/SUPABASE_MCP_CAPABILITIES.md](docs/SUPABASE_MCP_CAPABILITIES.md)** | Supabase MCP connector usage guide |
| **[SPEC_COMPLIANCE.md](SPEC_COMPLIANCE.md)** | Spec compliance tracking |

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, STRIPE_SECRET_KEY, SUPABASE_DATABASE_URL, RESEND_API_KEY

# Push database schema
pnpm drizzle-kit push

# Start development server
pnpm dev
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + TypeScript + shadcn/ui + Tailwind |
| API | tRPC v11 (Express adapter) |
| Database | PostgreSQL (Supabase) + Drizzle ORM |
| Auth | Supabase Auth |
| Payments | Stripe |
| AI | Perplexity (sonar-pro) + Anthropic Claude (claude-opus-4-5) |
| Email | Resend |
| Storage | Supabase Storage |
| PDF | PDFKit |

---

## Core Features

**For Subscribers:**
- Submit intake forms for legal letters
- AI generates letters in 3 stages (research → draft → assembly)
- Pay to unlock and send for attorney review
- Download approved PDFs
- Manage subscriptions (monthly/annual plans)

**For Attorneys:**
- Review queue of pending letters
- Inline editor for edits
- Approve, reject, or request changes
- Generate and send PDFs

**For Employees (Affiliates):**
- Unique discount codes
- Commission tracking
- Payout requests
- Referral dashboard

**For Admins:**
- Dashboard with system stats
- Full letter audit trail
- User management
- Pipeline job monitoring
- Force status transitions
- Affiliate oversight

---

## Project Structure

```
server/          → Express backend (routers, db, pipeline, email, stripe)
client/src/      → React frontend (pages by role, components, hooks)
drizzle/         → Database schema & migrations
shared/          → Shared types & constants
docs/skills/     → Canonical pipeline specifications
```

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for detailed breakdown.

---

## Key Workflows

### 1. Letter Generation
```
Submit intake form → AI Pipeline (3 stages) → Letter ready (generated_locked)
```

### 2. Payment & Review
```
Pay $29 → Stripe webhook → pending_review → Attorney review → Approve → PDF sent
```

### 3. Subscription
```
Choose plan → Stripe checkout → Subscription created → Submit letters
```

---

## Development

```bash
pnpm dev          # Start dev server
pnpm tsc --noEmit # TypeScript check
pnpm test         # Run all tests
pnpm lint         # Lint
```
