# v0.1.0

First release of the **visual-dialogue** skill: present proposals as a single
self-contained HTML with an embedded sticky-note feedback layer, and interpret
the feedback JSON that comes back.

## Highlights

- Round-trip protocol: generate proposal HTML → user places sticky notes in the
  browser → feedback JSON returns to the CLI.
- Self-contained artifacts (no CDN, no external assets); works over `file://`.
- Ships `assets/template.html` and `assets/feedback-layer.js`.
- Lean trigger-only `description` (~1/3 the size), so per-session token cost
  stays low. See `docs/adr/0001-description-is-trigger-only.md`.

## Install

Download the source archive and place its contents in
`~/.claude/skills/visual-dialogue/`. The archive contains only the runtime skill
(`SKILL.md` + `assets/`); design docs (`CONTEXT.md`, `docs/`) are kept in the
repo but excluded from the release download.
