# Proposals (Unreleased)

This folder holds **draft specs, implementation plans, and UI mockups** for features that have not been committed to a release yet. Each proposal is a self-contained bundle a future implementer can pick up without re-deriving design rationale.

Status legend:

- **Draft / Unreleased.** The proposal is the current best thinking; not approved for a specific release. Subject to change.
- **Accepted for vN.Y.** Promoted to a release plan; further changes go in the release plan, not the proposal.
- **Superseded.** Replaced by a newer proposal or a shipped feature. Kept for archaeology.

---

## Current proposals

| Folder | Feature | Value rank (2026-05-28) | Status |
|---|---|---|---|
| [`aliases-display-merge/`](./aliases-display-merge/) | Aliases & display-merge (B006, [#11](https://github.com/jprisant/obsidian-tag-curator/issues/11)) | **1 of 8** | Draft - recommended to promote to v0.2 |
| [`scope-expansion/`](./scope-expansion/) | Graph + autocomplete + properties chip ([#1](https://github.com/jprisant/obsidian-tag-curator/issues/1), [#2](https://github.com/jprisant/obsidian-tag-curator/issues/2), [#3](https://github.com/jprisant/obsidian-tag-curator/issues/3)) | **2 of 8** | Draft - v0.2 target |
| [`allow-only-mode/`](./allow-only-mode/) | Allow-only mode ([#4](https://github.com/jprisant/obsidian-tag-curator/issues/4)) | **3 of 8** | Draft - v0.2 target |

Value ranking is opinion (see the source-of-truth note below), not a commitment. Top-3 of 8 reflects the ranking in the conversation that produced these proposals.

---

## Each proposal bundle contains

- `spec.md` - the contract: vision, use cases, out of scope, data model, UX surfaces, edge cases, acceptance criteria.
- `plan.md` - the implementation roadmap: phased build order, per-phase tasks + tests, risks, rollout.
- `ui.html` - sample UI mockups: rendered surfaces in the same design system as `release-plans/plan_v0.1.0/ui-design_v0.1.0_converged.html`, so the visual language stays consistent.

Each artifact is self-contained but cross-references the other two and the v0.1 spec / scope-and-decisions doc.

---

## Source of truth

- **What's actually shipping** -> `docs/internal/scope-and-decisions.md` (D-IDs and Q-IDs).
- **What's been requested** -> GitHub issues #1-#17 and `docs/internal/backlog.md` (B-IDs).
- **What's been considered** -> this folder.

When a proposal is accepted for a release, copy the spec into the release's plan folder (`docs/internal/release-plans/plan_vX.Y.Z/`) and update this README to mark it Accepted.

---

## Adding a new proposal

1. Create a new folder under `proposals/` with a kebab-case name.
2. Drop in `spec.md`, `plan.md`, and `ui.html` matching the existing pattern.
3. Each artifact starts with a frontmatter-like table: Status, ID(s), Target, Author, Last updated.
4. Update this README's table.
