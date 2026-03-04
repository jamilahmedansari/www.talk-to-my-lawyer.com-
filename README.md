# Talk to My Lawyer

A full-stack legal letter generation and review platform powered by AI. Users submit intake forms, AI generates legal letters through a 3-stage pipeline (research → draft → assembly), attorneys review and approve, and subscribers download polished PDFs.

**Status:** Production-ready ✅ | **Last Updated:** March 2026

---

## Documentation Index

| Document                                                                               | Purpose                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **[PROJECT_TODO.md](PROJECT_TODO.md)**                                                 | **🎯 Centralized TODO tracker** — shared across all coding agents (Copilot, Claude, Codex) |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                                                 | Complete codebase mapping — server modules, database schema, client structure, data flows |
| **[CONTRIBUTING.md](CONTRIBUTING.md)**                                                 | Developer guide — setup, code style, feature workflow, testing, deployment                |
| **[REFACTOR_ROADMAP.md](REFACTOR_ROADMAP.md)**                                         | Future improvements — 7 planned phases for code organization and quality                  |
| **[.github/copilot-instructions.md](.github/copilot-instructions.md)**                 | GitHub Copilot coding conventions and project patterns                                    |
| **[docs/skills/letter-generation-pipeline/](docs/skills/letter-generation-pipeline/)** | Canonical spec for 3-stage AI pipeline (research → draft → assembly)                      |
| **[docs/skills/letter-review-pipeline/](docs/skills/letter-review-pipeline/)**         | Canonical spec for attorney review workflow and payment flow                              |
| **[docs/TTML_REMAINING_FEATURES_PROMPT.md](docs/TTML_REMAINING_FEATURES_PROMPT.md)**   | Historical validation reference (see ARCHITECTURE.md for current state)                   |
| **[docs/PIPELINE_ARCHITECTURE.md](docs/PIPELINE_ARCHITECTURE.md)**                     | Pipeline routing decision (Perplexity → Claude active, n8n dormant)                       |
| **[docs/CENTRALIZED_MCP_ACCESS.md](docs/CENTRALIZED_MCP_ACCESS.md)**                   | Single-source MCP config for Copilot, Claude Code, and Codex                              |
| **[docs/SUPABASE_MCP_CAPABILITIES.md](docs/SUPABASE_MCP_CAPABILITIES.md)**             | Supabase MCP connector usage guide                                                        |
| **[SPEC_COMPLIANCE.md](SPEC_COMPLIANCE.md)**                                           | Spec compliance tracking                                                                  |
| **[AUDIT_REPORT.md](AUDIT_REPORT.md)**                                                 | Architecture audit report                                                                 |
| **[todo.md](todo.md)**                                                                 | Feature and bug tracking                                                                  |

---

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm (package manager)
- Supabase account
- Stripe account

### Local Development

```bash
# Clone and install
gh repo clone jamilahmedansari/manus-talk-to-my-lawyer
cd manus-talk-to-my-lawyer
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start dev server
pnpm dev

# In another terminal, watch for changes
pnpm watch
```

**Dev server runs on:** `http://localhost:3000`

### Verify Setup

```bash
# TypeScript check
pnpm check

# Build
pnpm build

# Tests
pnpm test
```

---

### Required CORS/Auth Environment Variables

Set these variables in your deployment environment so cookie-based auth and cross-origin requests work safely:

- `APP_BASE_URL` (required): Primary frontend origin (example: `https://app.talk-to-my-lawyer.com`).
- `ADMIN_APP_BASE_URL` (recommended): Admin frontend origin if hosted separately.
- `STAGING_APP_BASE_URL` (recommended for non-prod): Staging frontend origin.
- `CORS_ALLOWED_ORIGINS` (optional): Comma-separated extra allowed origins.

Notes:

- Credentials are enabled for CORS, so only explicit origins are allowed.
- `*` is intentionally rejected when credentials are enabled to prevent insecure wildcard-cookie combinations.

---

## Tech Stack

| Layer        | Technology                                        |
| ------------ | ------------------------------------------------- |
| **Frontend** | React 18 + Vite + Wouter (routing) + TailwindCSS  |
| **Backend**  | Express.js + tRPC + Node.js                       |
| **Database** | PostgreSQL (Supabase) + Drizzle ORM               |
| **AI**       | Perplexity (research) + Claude (draft & assembly) |
| **Payments** | Stripe (subscriptions & one-time payments)        |
| **Email**    | Resend (transactional emails)                     |
| **Storage**  | S3 (PDF uploads)                                  |
| **Auth**     | Supabase Auth (JWT)                               |

---

## Core Features

**For Subscribers:**

- Submit intake forms for legal letters
- AI generates letters in 3 stages (research, draft, assembly)
- Pay to unlock and review letters
- Download approved PDFs
- Manage subscriptions (monthly/annual plans)
- Track letter history and status

**For Attorneys:**

- Review queue of pending letters
- Inline editor for edits
- Save multiple versions
- Approve, reject, or request changes
- Generate and send PDFs
- Commission tracking (for employees)

**For Admins:**

- Dashboard with system stats
- Full letter audit trail
- User management
- Pipeline job monitoring
- Force status transitions
- Manual job retries

---

## Project Structure

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for detailed breakdown. Quick overview:

```
server/          → Express backend (routers, db, pipeline, email, stripe)
client/src/      → React frontend (pages by role, components, hooks)
drizzle/         → Database schema & migrations
shared/          → Shared types & constants
docs/skills/     → Canonical pipeline specifications
```

---

## Key Workflows

### 1. Letter Generation

```
Submit intake form → AI Pipeline (3 stages) → Letter ready → Paywall
```

### 2. Payment & Review

```
Pay $200 → Stripe webhook → Attorney review → Approve → PDF sent
```

### 3. Subscription

```
Choose plan → Stripe checkout → Subscription created → Submit letters
```

**See:** `docs/skills/` for detailed pipeline specifications.

---

## Development Workflow

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server (http://localhost:3000)
pnpm check          # TypeScript check
pnpm build          # Production build
pnpm test           # Run tests
pnpm mcp:sync       # Generate MCP configs for Copilot / Claude / Codex
```

### Validation Gate

After every implementation:

1. `pnpm check` — 0 TypeScript errors
2. `pnpm build` — successful build
3. `pnpm test` — all tests pass

**See:** [CONTRIBUTING.md](CONTRIBUTING.md) for detailed developer guide.
