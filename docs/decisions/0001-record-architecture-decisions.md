---
status: "accepted"
date: 2026-06-25
decision-makers: Jonathan Prisant
consulted:
informed:
---

# Record architecture decisions

## Context and Problem Statement

Tag Visibility is becoming a public, open-source plugin. Significant engineering decisions (the display-only contract, the observer-per-scope model, override precedence, the runtime-only Notebook Navigator interop) were made with real trade-offs, but the reasoning lived in private planning docs. How do we keep the "why" discoverable for contributors without exposing internal strategy and roadmap material?

## Considered Options

- Keep all rationale in the private planning area only.
- Record durable engineering decisions as ADRs in the public repo.
- Write rationale inline as code comments only.

## Decision Outcome

Chosen option: "Record durable engineering decisions as ADRs in the public repo", because it gives contributors the architectural "why" at a stable, linkable location, while strategy and release planning stay in the private working area.

### Consequences

- Good, because the reasoning behind load-bearing decisions is public and versioned alongside the code.
- Good, because superseding an ADR leaves an auditable trail rather than erasing history.
- Bad, because it adds a small authoring step whenever a real decision is made.

### Confirmation

A decision is "recorded" when an ADR file exists under `docs/decisions/` with status `accepted`. Pull requests that make a significant architectural change should reference or add an ADR.

## More Information

ADRs follow [MADR 4.0.0](https://adr.github.io/madr/). The earlier project-setup decision history remains in the private working area and can be promoted here selectively if a given decision is worth publishing.
