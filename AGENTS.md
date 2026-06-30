# obsidian-tag-visibility

> Vault-wide tag visibility engine for Obsidian (display-only, file-safe, fully reversible)

## Project Overview

*Brief description of the project, its purpose, and key technologies.*

## Agents

### claude

- **Context:** `_agent-context/claude/CONTEXT.md`
- **Tasks:** `_agent-context/claude/TODO.md`
- **Session Log:** `_LOCAL/session-log/` (centralized - all agents write here)

### codex

- **Context:** `_agent-context/codex/CONTEXT.md`
- **Tasks:** `_agent-context/codex/TODO.md`
- **Session Log:** `_LOCAL/session-log/` (centralized - all agents write here)

## Conventions

- Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- See `CLAUDE.md` for detailed project rules and conventions
- Record architectural decisions as MADR v4 ADRs in `docs/decisions/` (see that directory's `README.md`)

## Key Files

- `CLAUDE.md` - Project instructions (Claude Code)
- `CHANGELOG.md` - Version history
- `docs/decisions/` - Architecture Decision Records (MADR v4)
- `_agent-context/` - Gitignored agent working context (claude/, codex/)
- `_LOCAL/` - Gitignored local docs, internal planning, and session logs
