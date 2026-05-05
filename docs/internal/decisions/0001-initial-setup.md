---
status: accepted
date: 2026-05-04
decision-makers: [jp]
---

# 1. Project Initialization

## Context and Problem Statement

New project obsidian-tag-curator is being initialized. We need to establish base structure, conventions, and tracking infrastructure before any meaningful work begins.

## Considered Options

- Ad-hoc scaffolding (create folders as needed)
- jp-library `init-project` skill with `public` profile
- Copy structure from an existing project

## Decision Outcome

Chosen: **jp-library `init-project` skill with `public` profile.**

Configuration:

- Profile: `public`
- Agents: claude, codex
- License: Apache-2.0
- Changelog: Keep a Changelog format
- Decisions: MADR v4 in `docs/internal/decisions/`
- Gitignored scratch: `_LOCAL/`

### Consequences

- Standardized agentic infrastructure from day one (AGENTS directories, session log, context files)
- Decision history tracked in MADR v4 format
- `_LOCAL/` available for per-machine scratch without polluting git
- Future scaling: profile can be upgraded (minimal -> standard -> public) by re-running init-project non-destructively
