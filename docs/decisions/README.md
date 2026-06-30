# Architecture Decision Records

This directory holds the architecture decision records (ADRs) for Tag Visibility. An ADR captures a single significant decision: the context that forced it, the options weighed, and the consequences. They exist so a future contributor (or a future us) can see not just what the code does, but why it is shaped that way.

## Format

ADRs use [MADR 4.0.0](https://adr.github.io/madr/) (Markdown Any Decision Records). Start from [`adr-template.md`](adr-template.md).

## Conventions

- **Filename:** `NNNN-short-title.md`, where `NNNN` is a zero-padded sequential number (`0001`, `0002`, ...). The padding keeps them in order in any file listing.
- **One decision per file.** Keep each ADR focused.
- **Append-only.** Do not rewrite an accepted ADR. To change a past decision, add a new ADR and set the old one's status to `superseded by [ADR-NNNN](NNNN-...md)`.
- **Status lifecycle:** `proposed` then `accepted`, later `deprecated` or `superseded`. Recording a `rejected` option is also useful when the path not taken is instructive.

## How to add one

1. Copy `adr-template.md` to `NNNN-your-title.md` (next number in sequence).
2. Fill in the context, options, and outcome.
3. Open it as `proposed`; flip to `accepted` once the decision is made.

## Index

- [0001 - Record architecture decisions](0001-record-architecture-decisions.md)

> Strategy, roadmap, and release planning live outside this repo, in a private working area. This log is only for durable, public-worthy engineering decisions.
