# Centralized MCP Access (Copilot + Claude Code + Codex)

This repo now uses one MCP source of truth and generates client-specific config files.

## Source of Truth

- Central registry: `mcp/registry.json`
- Sync script: `scripts/sync-mcp-configs.mjs`

## Generate Client Configs

Run:

```bash
pnpm mcp:sync
```

Generated outputs:

- Copilot (VS Code): `.vscode/mcp.json`
- Claude Code: `.mcp/generated/claude.mcp.json`
- Codex: `.mcp/generated/codex.mcp.json`

## How to Use

1. Edit `mcp/registry.json` to add/remove MCP servers once.
2. Run `pnpm mcp:sync`.
3. Point each client to its generated config file (or copy values into each client’s MCP settings).

## Notes

- Copilot uses `.vscode/mcp.json` directly in this workspace.
- Claude Code and Codex config schema can vary by version; if a client expects different keys, keep `mcp/registry.json` unchanged and only adjust the generated client file.
- Existing `chat.mcp.serverSampling` settings in `.vscode/settings.json` remain intact.
