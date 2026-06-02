# Tag Curator v0.1.0 BRAT Tester Guide

A 30-to-45-minute hands-on walkthrough that exercises every locked surface in Tag Curator v0.1.0. For human testers receiving a BRAT pre-release link.

If you're the tester reading this: **read section 0 (Prerequisites) first**, then **section 1 (Install)**. After that, section 2 walks you through the first-run experience surface by surface. Section 3 is bug reporting. The companion `TESTING.md` at the repo root has the formal 6-cell smoke matrix if you want to be thorough; this guide is the friendlier version.

---

## 0. Prerequisites

You need:

- **Obsidian** (latest stable, minimum 1.9.10). Desktop or mobile - both are in scope for v0.1.0.
- **A fresh, throwaway test vault.** Do not test on your real vault. Create a new vault, copy in 10-20 markdown files with a variety of tags (or use the synthetic vault in the next section).
- **BRAT plugin** installed in that test vault. If you have not used BRAT before: in Obsidian's Community Plugins directory, search for `Obsidian42 - BRAT` and install it.
- About **30 to 45 minutes** of uninterrupted time. Test surfaces take 3-5 minutes each.

### Optional: a synthetic test vault

If you want a representative vault quickly, create one with these tags scattered across notes:

- "Real" tags: `#ai`, `#project/acme`, `#journal`, `#meeting`, `#reading`, `#wip`, `#todo`, `#draft`
- Noise tags Tag Curator's presets should catch: `#ffaa00`, `#abc`, `#abcdef`, `#top`, `#section-3`, `#a`, `#x`, `#1234`
- Orphan tags (used once): `#oneshot`, `#test123`, `#tmp`

Mix some into note frontmatter (`tags: [ai, journal]`) and some inline (`#meeting`). That gives Tag Curator a representative sample of both Source values to work with.

---

## 1. Install via BRAT

1. Open the test vault in Obsidian.
2. Open Settings (Cmd/Ctrl + `,`) -> Community Plugins -> Obsidian42 - BRAT.
3. Click **Add Beta Plugin**.
4. Paste the repository URL: `https://github.com/jprisant/obsidian-tag-curator`.
5. Pick the latest release tag (`v0.1.0-rc1` if pre-release, or `0.1.0` if final).
6. Click Add Plugin.
7. Go to Settings -> Community Plugins. Find Tag Curator and toggle it on.

If anything fails at this step (manifest mismatch, download error, plugin doesn't appear in the list), that's a release-pipeline bug. **Stop here and report it.**

---

## 2. First-run walkthrough

### 2.1 Welcome modal (3 minutes)

On first enable, a modal opens.

- [ ] **Header** should say `Tag Curator is now enabled` (eyebrow), `Choose how to start` (h3). If it says anything like "Got it, enable", that's a regression.
- [ ] **Safety promises** section should be a single highlighted strip with 3 left-aligned check rows (Display-only / File-safe / Fully reversible). Not three centered card boxes.
- [ ] **Two preset cards** should be visible (Hide hex color codes + Hide URL anchor fragments) with toggles. Try toggling one off and back on.
- [ ] **Integration cards** should list Tag Wrangler, Notebook Navigator, Colored Tags Wrangler with state pills (Enabled / Installed / Not installed) reflecting your vault's reality.
- [ ] **Footer** should have two buttons: **Start in preview mode** (secondary) and **Start curating** (primary, accent color), with a one-sentence explainer between them about what Preview mode does.
- [ ] Click **Start curating**.
- [ ] The modal closes. Reload the plugin (toggle off and on in Settings). The modal should NOT reappear.

### 2.2 Tag pane (1 minute)

Open the tag pane (left sidebar). You should see hex codes and URL anchor fragments missing from the list (assuming you have any in your synthetic vault). The presets are doing their job.

- [ ] Hidden tags do not appear.
- [ ] No console errors. (Open Developer Tools with Ctrl/Cmd + Shift + I and check the Console tab.)
- [ ] The status bar at the bottom of Obsidian shows `Tag Curator: N tags hidden` where N reflects how many tags the presets are filtering.
- [ ] Click the status bar item. The Tag List view should open in the right sidebar, pre-filtered to hidden tags.

### 2.3 Tag list view, sidebar leaf (5 minutes)

You should now be looking at the Tag List in the right sidebar.

- [ ] Each row has a checkbox, then Tag, Count, First seen, Last used, Source, Visible?, Rule.
- [ ] Hidden rows are visually struck through.
- [ ] Hover the `?` icon next to **Source** in the column header. A tooltip should appear explaining what Source means.
- [ ] Do the same for Count, First seen, Last used, and Visible? - each should have its own tooltip.
- [ ] Click the **Tag** column header. The list re-sorts alphabetically.
- [ ] Click it again. Sort reverses.
- [ ] Click the All filter chip. Now you see every tag, hidden and shown.
- [ ] Click Orphans. You see only count-1 tags.
- [ ] Check a few row checkboxes. The bulk-actions bar should appear at the top showing "N selected of M on this page" with Hide / Unhide / Send to Tag Wrangler / Clear buttons.

### 2.4 Settings tab (3 minutes)

Open Settings (Cmd/Ctrl + `,`) -> Tag Curator.

- [ ] Top of the settings panel should be a tab row: General / Tag list / Presets / Custom rules / Commands / Advanced / Profiles[v0.2] / Aliases[v0.3].
- [ ] **General tab** should show the stats header (4 cards: Total tags / Hidden now / Active rules / Orphans) followed by Enable, Preview mode, and Panic disable rows.
- [ ] Click **Preview mode** toggle. A **state banner** should appear above the panel (amber color) saying `Preview mode is on. Matched tags are flagged in place, not hidden.` with a `Turn off preview` button.
- [ ] Open the Tag pane separately. Tags that were hidden should now be visible with a flagged appearance.
- [ ] Click `Turn off preview` in the banner. The banner disappears and tags are hidden again.

### 2.5 Tag list as a Settings tab (D-011, 2 minutes)

- [ ] Click the **Tag list** tab in the Settings tab row. The Tag List view should render here too.
- [ ] Note: this is the **same component** as the sidebar leaf. If you select tags here, then check the sidebar leaf, the selection should persist.

### 2.6 Presets tab (3 minutes)

- [ ] **5 preset cards** listed: Hide hex color codes (on by default), Hide URL anchor fragments (on by default), Hide single-character tags (off), Hide purely numeric tags (off), Hide orphan tags (off).
- [ ] Each card shows a count: `N tags affected` when on, `off` when off.
- [ ] Click `More details` on a card. The match pattern, action, and scope should reveal.
- [ ] Click `More details` again to hide.
- [ ] Toggle on Hide single-character tags. The tag pane (if open) updates immediately.

### 2.7 Custom rules tab + rule editor (5 minutes)

- [ ] Empty card list at the top, then a dashed `+ New rule` card.
- [ ] Click `+ New rule`.
- [ ] Edit mode opens. Header shows breadcrumb (`Back to rules / Custom rules / New rule`), then a prominent title row (toggle + `Untitled rule`).
- [ ] Below that, sectioned form: Type / Identity / Match / Then.
- [ ] In Type, the dropdown should read `Pattern match (regex)` by default (NOT `regex`).
- [ ] In Identity, name the rule `Test rule`.
- [ ] In Match, the sentence-builder should read "When a tag's name [matches the regex] [(text input)]". Type `^test`. As you type, the regex status should show `✓ valid`.
- [ ] **Right-docked preview panel** on the right should update live, showing tags that match `^test`.
- [ ] If the preview is empty, type something that actually matches a tag in your vault.
- [ ] Click Save. You return to the card list with one card.
- [ ] Click your new card. Edit mode opens with the rule pre-filled.
- [ ] Click the toggle in the title row to disable. The card list should reflect "off".
- [ ] Click the toggle again to re-enable.
- [ ] Click Delete rule -> confirm. Rule disappears.

### 2.8 Commands palette (2 minutes)

- [ ] Open the command palette (Cmd/Ctrl + P).
- [ ] Type `Tag Curator:`. Six commands should appear.
- [ ] Run `Toggle preview mode`. A Notice confirms; banner appears.
- [ ] Run it again to turn off.
- [ ] Run `Open tag list (hidden tags only)`. The Tag List opens with the Hidden filter chip active.
- [ ] Run `Rescan vault tags`. A "rescanning..." Notice appears, then "rescan complete".

### 2.9 Panic disable (2 minutes)

- [ ] Settings -> General -> scroll to "If something looks wrong".
- [ ] Click `Run panic disable`.
- [ ] The plugin disables itself. The tag pane shows every tag. A muted **state banner** says `Tag Curator is off. No tags are being curated.` with a `Turn on` button.
- [ ] Click `Turn on`. The plugin enables again; the banner disappears; previously hidden tags hide again.

### 2.10 Advanced tab (1 minute)

- [ ] Index maintenance heading with `Reindex now` button and `Last full reindex` info.
- [ ] Performance heading with sidecar debounce input.
- [ ] Troubleshooting heading with Debug logging toggle.

---

## 3. Reporting bugs

If anything in section 2 fails, capture:

1. **Which section + checkbox failed** (e.g. "Section 2.7, the regex `✓ valid` status did not appear").
2. **Exact reproduction steps** - what you clicked, in what order.
3. **What you expected** vs. **what you saw**.
4. **Console errors** - in Obsidian, Ctrl/Cmd + Shift + I -> Console tab. Screenshot any red errors.
5. **Vault size** - approximate note and tag counts.
6. **Obsidian version + platform** - Settings -> About.

Open an issue at [https://github.com/jprisant/obsidian-tag-curator/issues](https://github.com/jprisant/obsidian-tag-curator/issues) with this info.

### Known-not-bugs

These are deliberate v0.2 placeholders. Do not report them:

- Bulk Hide / Bulk Unhide / Bulk Add description show a Notice pointing to v0.2 (the per-tag overrides surface is B009).
- Welcome modal shows hardcoded integration cards (real detection is B004 in v0.2).
- No drag-to-reorder in the rule list (B012 in v0.2).
- No graph view / autocomplete / properties chip scope in rules (B011 and scope-expansion proposal in v0.2).

---

## 4. Quick reference card

If you've done section 2 and want a checklist for a smoke walk on a different vault size or platform:

- [ ] Plugin loads, no console errors.
- [ ] Welcome modal appears once.
- [ ] Tag pane: hex codes and URL fragments hidden.
- [ ] Status bar shows hidden count.
- [ ] Tag list view: both hosts (sidebar leaf + Settings tab) render the same data.
- [ ] Preview mode toggle: state banner appears amber, tag pane re-renders with flagged styling.
- [ ] Disable plugin (toggle in Community Plugins): every tag visible immediately.
- [ ] Re-enable: previously hidden tags hide again.
- [ ] Panic disable: state banner appears muted; click Turn on to recover.
- [ ] Rule editor: create a regex rule, watch the right-docked preview update live.
- [ ] Commands palette: all 6 Tag Curator commands present and functional.

If you walk this checklist on Windows + macOS + iOS, you've covered the v0.1.0 6-cell BRAT matrix.

---

## 5. After testing

- Pass: open an issue with title `BRAT smoke pass: <platform> <vault-size>` and a checked summary of the section 4 quick reference.
- Fail: open one issue per bug per section 3 instructions.

Thank you for testing.
