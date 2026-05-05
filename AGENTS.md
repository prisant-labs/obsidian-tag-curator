# obsidian-tag-curator

> Vault-wide tag visibility and curation engine for Obsidian (display-only, file-safe, fully reversible)

## Project Overview

*Brief description of the project, its purpose, and key technologies.*

## Agents

### claude

- **Context:** `AGENTS/claude/CONTEXT.md`
- **Tasks:** `AGENTS/claude/TODO.md`
- **Session Log:** `AGENTS/session-log/` (centralized - all agents write here)

### codex

- **Context:** `AGENTS/codex/CONTEXT.md`
- **Tasks:** `AGENTS/codex/TODO.md`
- **Session Log:** `AGENTS/session-log/` (centralized - all agents write here)

## Conventions

- Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- See `CLAUDE.md` for detailed project rules and conventions
- Record architectural decisions as MADR v4 ADRs in `docs/internal/decisions/` (see that directory's `README.md`)

## Key Files

- `CLAUDE.md` - Project instructions (Claude Code)
- `CHANGELOG.md` - Version history
- `docs/internal/decisions/` - Architecture Decision Records (MADR v4)
- `_LOCAL/` - Gitignored scratch directory (per-machine, not shared)
