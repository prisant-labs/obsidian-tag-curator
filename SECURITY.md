# Security Policy

## Safety model

Tag Visibility is **display-only**. It decorates how tags render in Obsidian's UI by toggling CSS classes on existing DOM nodes. It does not edit note content, and it makes no network requests. Its only persisted data is local: plugin settings in `data.json` and a tag-metadata sidecar (`tags.json`) inside your vault. Disabling or uninstalling the plugin restores every tag. Anything that violates these properties is a security concern, not just a bug.

## Reporting a vulnerability

Please report suspected vulnerabilities responsibly:

1. **Do not open a public issue.**
2. Use GitHub's [private vulnerability reporting](../../security/advisories/new), or email the maintainers via the address on the [Prisant Labs](https://github.com/prisant-labs) org profile.
3. Include the Obsidian version and platform, the Tag Visibility version, steps to reproduce, the impact you observed, and any suggested fix.

We will acknowledge receipt within 48 hours and provide a detailed response within 5 business days.

## Supported versions

Security fixes are applied to the latest released version. Please reproduce on the latest release before reporting.

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | No |

## Scope

**In scope:** anything that lets the plugin modify note content, exfiltrate vault data, execute remote code, or persist effects after it is disabled or uninstalled - all of which would contradict the display-only safety model above.

**Out of scope:** cosmetic rendering glitches (please open a normal issue instead), and the behavior of third-party plugins Tag Visibility integrates with at runtime (such as Notebook Navigator or Tag Wrangler) - report those to their respective projects.
