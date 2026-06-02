# Getting Started with Tag Curator

Welcome. This guide takes you from install to your first curated tag, and shows you how Tag Curator v1 keeps your vault calm without ever touching a single note.

If you read nothing else, read this: **Tag Curator never edits your notes.** Everything it does is display-only and fully reversible. You can turn it off at any moment and every tag comes straight back.

---

## What Tag Curator does

Tag Curator hides, flags, and surfaces noisy tags across Obsidian's interface so the tag pane and your tag-driven views become useful again, and it does all of this without writing a single character into your notes. Every change is display-only and instantly reversible: disable the plugin, or uninstall it, and every tag returns exactly as it was. You stay in control through a workspace you can watch live, a status bar that always tells you the current state, and a one-click panic switch for the rare moment something looks off.

---

## Install

### Via BRAT (beta)

Tag Curator ships its beta builds through BRAT (Beta Reviewers Auto-update Tool), which installs the plugin straight from GitHub releases and keeps it updated as new betas land.

1. In Obsidian, open Settings, then Community Plugins, and install **Obsidian42 - BRAT** if you do not already have it.
2. Open BRAT's settings and click **Add Beta Plugin**.
3. Paste the repository URL: `https://github.com/jprisant/obsidian-tag-curator`.
4. Pick the latest release tag when prompted.
5. Click **Add Plugin**.
6. Go to Settings, then Community Plugins, find **Tag Curator**, and toggle it on.

BRAT will offer updates automatically whenever a new beta is published.

> Tip for first-time testers: use a fresh, throwaway test vault, not your real one. Tag Curator is file-safe, but a scratch vault is the calmest way to learn the workflow.

### Via the community directory (future)

Once Tag Curator graduates from beta, it will be available directly in Obsidian's Community Plugins browser. At that point you will search for "Tag Curator," click Install, then Enable. No BRAT required. Until then, BRAT is the way in.

<!-- screenshot placeholder: BRAT "Add Beta Plugin" dialog with the repo URL filled in -->

---

## Your first 60 seconds

The first time you enable Tag Curator, a **welcome modal** opens once. It does three things:

1. **States the trust contract up front.** The very first thing you see is the promise: display-only, file-safe, fully reversible. This is not marketing - it is how the plugin is built.
2. **Offers two safe default presets.** Two toggles are already on: **Hide hex color codes** (tags like `#FFAA00` that get imported from web clippings) and **Hide URL anchor fragments** (tags like `#top` or `#section-3` that come from pasted links). These are the safest possible starting point: they only ever catch obvious noise.
3. **Lets you choose how to start.** **Start curating** applies rules normally. **Start in preview mode** flags matched tags in place instead of hiding them, so nothing disappears while you find your footing.

Pick **Start curating** for the normal experience, or **Start in preview mode** if you want to watch before you commit. Either choice is reversible, and the welcome modal will not nag you again.

<!-- screenshot placeholder: welcome modal showing the safety strip and the two preset toggles -->

---

## The Curation Workspace

The **Curation Workspace** is where you actually curate. It is a normal Obsidian workspace leaf (a dockable, splittable pane), not a settings screen, so it lives on screen right next to the tags you are working on.

### How to open it

Open the command palette (Ctrl/Cmd + P) and run either of these:

- **Tag Curator: Open Curation Workspace** - opens the workspace on its own.
- **Tag Curator: Open beside the tag pane** - opens the workspace and the native tag pane side by side, arranged for you in one move.

You can also open it from the status bar (click the Tag Curator item) or from the **Open Curation Workspace** button in Settings.

### What each part does

- **The tag table.** Every tag in your vault, with its count, when it was first and last seen, its source (frontmatter or inline), its visibility state per scope, and the rule (if any) affecting it. Sortable, searchable, and virtualized so it stays smooth even on large vaults.
- **Filter chips.** One-click filters across the top: Hidden, Flagged, Orphans, Frontmatter, Inline, Unreviewed, and By rule. Click **Hidden** to see exactly what is currently being filtered out.
- **The inline rule editor.** Rules show as cards. Click a card to edit it in place; click **+ New rule** to create one. The editor never leaves the workspace, so you never lose sight of your tags.
- **Live preview.** As you type a rule, the affected-tags list updates immediately, and so does the real tag pane beside it.
- **Bulk actions.** Select several tags, then hide, unhide, flag, add a description, or send them to Tag Wrangler in one action.

### The side-by-side loop

This is the heart of v1. With the workspace docked beside the tag pane, your curation loop becomes a single continuous glance:

```
[ Curation Workspace ]  |  [ native Tag pane ]
  edit a rule here       |    watch tags hide or flag here, live
```

No more opening Settings, writing a rule blind, closing Settings to check, and reopening to adjust. You edit, you watch, you adjust, all in view. That is the entire point of the Curation Workspace.

<!-- screenshot placeholder: Curation Workspace docked beside the native tag pane, mid-edit -->

---

## Curating tags

### Create a rule, preview it, commit it

1. In the Curation Workspace, click **+ New rule**.
2. Give it a name, then pick a type: **Pattern match (regex)**, **Count threshold**, or **Specific tags**.
3. Fill in the match. As you type, the live preview shows every tag the rule would affect, and the tag pane reacts beside you.
4. When the preview looks right, save the rule. The change lands immediately.

If you would rather commit cautiously, turn on Preview mode first (see Safety and recovery below): the rule will flag matched tags in place rather than hiding them, so you can confirm before anything disappears.

### Pin a tag: always-show / always-hide (overrides)

Sometimes you do not want to author a whole rule, you just want one specific tag handled a certain way. That is an **override**, a per-tag decision that beats every rule:

- **Always show** pins a tag visible no matter what any rule says. This is your safety net: if a rule hides one tag too many, pin that tag to always-show and move on.
- **Always hide** pins a single tag out of sight without writing a rule for it.

Set an override from a tag's row in the workspace. Overrides persist, and always-show wins over everything, so a pinned tag can never be hidden by accident.

### "Why is this tag hidden?"

On any row, ask **why is this hidden?** Tag Curator tells you exactly what is acting on it: a specific preset, a custom rule, or an override. No guessing, no mystery. A tag is never hidden without a traceable reason you can read in one click.

<!-- screenshot placeholder: a tag row's "why is this hidden?" attribution popover -->

---

## Where curation shows up (scopes)

A **scope** is a place in Obsidian where tags appear and where Tag Curator can act. v1 covers the four surfaces where tags actually show up:

- **Tag pane** - Obsidian's native tag list.
- **Notebook Navigator** - the tag tree in the Notebook Navigator plugin, if you use it.
- **Properties** - frontmatter tags rendered in the Properties panel.
- **Autocomplete** - the tag suggestions you get while typing, so you are not offered a tag you just hid.

Each scope is **independent and reversible on its own**. To turn one on or off, go to **Settings, then Scopes**, and toggle it there. If a single scope ever misbehaves, switch off just that scope; the others keep working and the plugin stays on. Hiding a tag, by default, hides it consistently across all four places it lives.

<!-- screenshot placeholder: Settings > Scopes section with the four scope toggles -->

---

## Working with other plugins

Tag Curator is built to be a good ecosystem citizen. Companion plugins make it better when present, and are never required.

- **Tag Wrangler (rename delegation).** Tag Curator is display-only, so it never renames tags itself. When Tag Wrangler is installed, Tag Curator composes into its menus and the bulk **Send to Tag Wrangler** action hands selected tags off for a real rename. When Tag Wrangler is absent, that action is disabled with a tooltip explaining why.
- **Style Settings (restyling).** Tag Curator registers its CSS variables with Style Settings, so themers and power users can restyle hidden and flagged tags with no code. If Style Settings is not installed, sensible defaults apply and nothing breaks.
- **Dataview, Tasks, and Bases (unfiltered, always).** This is a promise, not a side effect: Tag Curator never patches Obsidian's tag data. Dataview, Tasks, and Bases always see the real, complete, unfiltered set of tags. Tag Curator changes what you *see* in the UI, never what your queries *find*.

---

## Safety and recovery

Tag Curator is designed so you always know what state you are in and can always get back to normal.

- **Preview mode.** Instead of hiding matched tags, Preview mode flags them in place, so you can see a rule's full impact before committing to it. Toggle it any time.
- **The state banner.** Whenever you are in a non-default state, a banner sits above every Tag Curator surface. Preview mode on? You see it. Plugin off? You see it. Each banner has an inline button to return to the default.
- **Panic disable.** If anything ever looks wrong, run **Tag Curator: Panic disable** from the command palette (or the button in Settings). In one shot, every display effect is removed, the plugin disables itself, and a banner confirms "Tag Curator is off" until you re-enable. Your notes are untouched, as always.
- **The status bar.** A status bar item shows the current state at a glance (for example, how many tags are hidden) and is one click away from opening the workspace filtered to hidden tags.
- **Uninstall restores everything.** Disabling or uninstalling Tag Curator returns every tag immediately. Because nothing was ever written to your notes, there is nothing to clean up.

<!-- screenshot placeholder: the persistent state banner reading "Preview mode is on" with its inline action -->

---

## FAQ

**Will this edit my notes?**
No. Never. Tag Curator is display-only. It does not write tags, rename tags, or change frontmatter. It changes only what you see in the UI.

**Where did my tag go?**
Three places tell you. The status bar shows how many tags are hidden right now. The **Hidden** filter chip in the Curation Workspace lists every hidden tag. And on any row, **why is this hidden?** names the exact preset, rule, or override responsible.

**Can I get a hidden tag back?**
Instantly. Pin it to **always-show** from its row, adjust the rule that hid it, or run panic disable to bring everything back at once.

**Will my Dataview / Tasks / Bases queries change?**
No. Those plugins always see the real, unfiltered tag data. Tag Curator only affects display surfaces, never query results.

**Does it work on mobile?**
Yes. The plugin's `manifest.json` sets `isDesktopOnly` to `false`, so Tag Curator runs on both desktop and mobile.

**Do I need Tag Wrangler, Style Settings, or Notebook Navigator?**
No. Tag Curator works fully on its own. If those plugins are installed, Tag Curator integrates with them; if not, it degrades gracefully and nothing breaks.

**A scope is acting up. Do I have to disable the whole plugin?**
No. Go to Settings, then Scopes, and turn off just that one scope. Every other scope keeps working.

---

## Expert aside: for power users

A few notes for those who want to go deeper:

- **Where state lives.** Settings, presets, custom rules, and overrides live in `data.json`. Per-tag metadata (count, first seen, last seen, source) lives in `tags.json`. Both sit in `.obsidian/plugins/tag-curator/` as pretty-printed JSON, so they diff cleanly in git.
- **Override precedence.** Overrides resolve ahead of rules. Always-show beats every rule and every other override; always-hide beats every rule but yields to always-show. So pinning a tag to show is the strongest, safest statement you can make.
- **Regex rules.** Pattern-match rules take standard regular expressions, validated live as you type. The preview list is the fastest way to confirm a pattern catches what you intend and nothing more.
- **Per-scope kill switches.** Each scope is an independent observer. If you are on an Obsidian or plugin version where one surface behaves oddly, disable that single scope in Settings, then Scopes, and report it; the rest stay healthy.
- **Restyling.** Hidden and flagged tags carry stable CSS classes and Style Settings variables, so you can theme them however you like without editing plugin code.

---

That is the whole loop: open the workspace beside the tag pane, write a rule, watch it land, pin what you want to keep. Everything is display-only, everything is reversible, and the status bar always tells you where you stand. Happy curating.
