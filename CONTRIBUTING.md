# Contributing to obsidian-tag-curator

Thank you for your interest in contributing! This document provides guidance on how to contribute to Tag Curator.

## Getting Started

### Prerequisites

- Node.js 18+ (check `.nvmrc` for the recommended version)
- npm (comes with Node.js)

### Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/obsidian-tag-curator.git`
3. Install dependencies: `npm ci`

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes in the `src/` directory
3. Run linting: `npm run lint` (required before committing)
4. Build the plugin: `npm run build` (or use `npm run dev` for watch mode)
5. Commit with a [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/) message:
   - `feat: add new feature`
   - `fix: resolve issue`
   - `chore: update dependencies`
   - `docs: improve documentation`
   - `style: format code`
6. Push to your fork and open a Pull Request

## Code Quality

All code must pass linting before merging:

```bash
npm run lint
```

We use ESLint with TypeScript support. Configuration is in `.eslintrc.cjs`.

## Project documentation

- [`docs/DESIGN.md`](docs/DESIGN.md) - design overview and core concepts.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) - architecture and the rule-evaluation model.
- [`docs/TESTING.md`](docs/TESTING.md) - the QA smoke matrix and manual test plan.

## Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Please structure your commits as:

```
type(scope): description

Optional body explaining the change in detail.
```

Valid types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `ci`, `test`

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run linting and verify the build: `npm run lint && npm run build`
5. Commit with a descriptive, conventional message
6. Push to your fork
7. Open a Pull Request with a clear description of your changes

## Reporting Bugs

Please open a [GitHub Issue](../../issues/new?template=bug_report.yml) with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
