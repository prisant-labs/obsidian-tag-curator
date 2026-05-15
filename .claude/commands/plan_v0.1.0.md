---
description: Open or execute the Tag Curator v0.1.0 release plan
argument-hint: "[status|next|task <N>|execute] (default: status)"
---

# /plan_v0.1.0

The user has invoked `/plan_v0.1.0`. This command operates on the v0.1.0 release plan for the Tag Curator Obsidian plugin.

**Plan location:** `docs/internal/release-plans/plan_v0.1.0.md`

**Source materials the plan was synthesized from (read these if context is missing):**
- `docs/internal/discovery/tag-curator-spec_opus-4.7_2026-04-30.md` (canonical spec, §9 = v0.1 scope)
- `docs/internal/discovery/implementation-plan_opus-4.7_deep-research_2026-04-30.md` (primary-source API contracts)
- `docs/internal/discovery/tag-curator-project-overview_chatgpt-5.5_2026-05-05.md` (executive synthesis)
- `docs/internal/discovery/ui-ideas/*.png` (directional v0.2+ mockups, not v0.1 binding)

## Argument modes

Parse `$ARGUMENTS` and dispatch:

- **`status`** (default when no args): Report the plan's progress.
  1. Read `docs/internal/release-plans/plan_v0.1.0.md`.
  2. Count tasks (look for `### Task N:` headings, 1-18).
  3. Count step checkboxes overall: `- [ ]` (open) vs `- [x]` (done).
  4. Identify the first task that still has any open step.
  5. Print a concise report: "N/18 tasks done, M/T steps complete, next is Task X: <title>". Do not start executing.

- **`next`**: Find the next unchecked step and run only that one step.
  1. Read the plan.
  2. Locate the first `- [ ]` line in document order.
  3. Read the surrounding task context (the `### Task N:` heading it belongs to).
  4. Execute that step exactly as written. Show the diff or command output.
  5. Update the checkbox in the plan file from `- [ ]` to `- [x]` after the step succeeds.
  6. Stop. Do not auto-continue to the next step.

- **`task <N>`** (e.g., `task 6`): Execute every open step in Task N sequentially.
  1. Read the plan.
  2. Locate `### Task <N>:` heading.
  3. For each `- [ ]` step in that task, execute it, then check it off in the file.
  4. If any step fails, stop and report. Do not proceed past a failure.
  5. After the last step succeeds, run any commit command shown in that task's final step.
  6. Stop at the task boundary. Do not start Task N+1.

- **`execute`**: Run the entire plan from the first open step to the end.
  1. **First**, invoke the `superpowers:executing-plans` skill via the Skill tool. That skill is the authority on plan execution discipline (commit cadence, verification gates, when to stop and ask).
  2. Hand off the plan path `docs/internal/release-plans/plan_v0.1.0.md` to it.
  3. Do not bypass its discipline (no batching of unrelated tasks, no skipping verification steps).

## Execution discipline

Regardless of mode, when executing any step:

1. **Honor exact file paths and code blocks** in the plan. The plan was written assuming an engineer with zero codebase context, so deviations require justification.
2. **Run the verification commands** the plan specifies (e.g., `npm run build 2>&1 | tail -40`). Report results before moving on.
3. **Commit at the boundaries the plan specifies.** Do not amend; do not skip the commit step.
4. **Check off completed step boxes in the plan file** using the Edit tool with `replace_all: false` so the document tracks progress for later sessions.
5. **Stop and ask the user before any destructive or remote action**: `git push`, `git tag`, force-push, etc. Task 18 explicitly defers `git push` to user confirmation.
6. **If a step fails**, do not retry by guessing. Diagnose, surface the failure, and ask the user how to proceed.

## Pre-execution sanity check

Before executing any step, confirm:

- Current branch is `release/v0.1.0` if the plan's Pre-flight has completed; otherwise `main`.
- `git status --short` is empty.
- `npm ci` has been run at least once in this session.

If any of those is not true, mention it in the response and ask the user whether to proceed anyway.

## Reporting

After the run (status, next, task, or execute), close with a one or two sentence summary:

- What was just done.
- What is next in the plan (cite the task and step).
- Any deviations from the plan text.

Do not narrate internal deliberation; just state results and the next step.
