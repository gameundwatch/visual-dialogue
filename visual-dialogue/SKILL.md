---
name: visual-dialogue
description: Present proposals, mockups, and design options as a single self-contained HTML with a sticky-note feedback layer. Use when the user asks to see, compare, or preview something (e.g. "show me", "which looks better"), or — before writing a text answer — whenever your reply would otherwise describe look-and-feel in words (color, spacing, layout, hierarchy, A/B options): that urge to describe a visual in prose is the signal to generate the HTML instead. Also consult it when the user pastes a feedback JSON (keys "issue"/"notes").
---

# visual-dialogue

A round-trip protocol that turns design discussions from text-based into
visual: Claude generates a **single self-contained HTML** proposal, the user
places **sticky notes** on it in the browser, and the resulting JSON comes
back to the CLI. One issue (one decision to make) = one HTML file. Designed
for one or a few round trips; artifacts are disposable and persistence is
best-effort only.

## Language policy

The purpose of this skill is a shared *visual* medium, not a shared natural
language. Split strictly:

- **Machine-facing, always English:** file names, `data-issue`, `data-round`,
  `data-variant`, `data-ref` values, JSON keys and note `type` values, all
  code and code comments in generated HTML.
- **Human-facing, always the conversation language:** page copy, issue title
  and context, variant display labels (`data-variant-label`), intent/tradeoff
  notes, the response log, and the feedback-layer UI labels via
  `window.DFB_LABELS` (see below). Note *text* written by the user arrives in
  their language; interpret it as-is.

`assets/feedback-layer.js` ships with English default labels. To localize,
define `window.DFB_LABELS` in a `<script>` **before** the inlined layer,
translating every value (see the block in `assets/template.html`). If the
conversation is in English, omit the block. Never translate keys, and never
edit feedback-layer.js itself.

## Workflow

```
1. Pin the issue          … reduce to ONE decision the user must make
2. Generate the HTML      … proposal-<issue>-r<n>.html (rules below)
3. Open it in the browser … run open / xdg-open / start automatically
4. User places notes      … retrieves JSON via Copy or Save
5. Receive & interpret    … see "Interpreting feedback" below
6. Settle, or generate r(n+1) with a response log at the top
```

## Proportionality: full run, offer, or skip

Generating a proposal HTML costs the user a context switch to the browser.
Match the machinery to the stakes:

- **Generate without asking** — a direction must be chosen between
  alternatives, a new screen/layout/structure is being proposed, or the user
  explicitly asked to see, demo, preview, or compare something.
- **Offer first, generate on acceptance** — the visual matter is minor or
  already decided: single-property tweaks, small color/wording adjustments,
  mechanical application of an earlier decision. Answer normally, then add
  one short sentence offering the HTML view. Never expand this offer into a
  pitch; one sentence, then move on.
- **Skip entirely** — no visual judgment is involved: pure code fixes,
  logic questions, refactoring with unchanged appearance.

When unsure between the first two, prefer offering: a declined offer costs
one line, an unwanted HTML costs a browser round trip.

## Generation rules

File name: `proposal-<issue>-r<n>.html` (kebab-case issue id, round number,
first round is r1). Write it to the current working directory, or follow the
user's existing convention (e.g. a `design/` directory) if one exists.

Read `assets/template.html` for the skeleton and follow its structural
contract:

1. **Single file, zero external dependencies.** No CDN, no web fonts, no
   external images, no fetch. Draw images as inline SVG if needed. The file
   must work fully when opened via `file://`.
2. **`<body data-issue="<issue>" data-round="<n>">`** is mandatory.
3. **At least two variants** when the issue is a choice between directions,
   laid out side by side for at-a-glance comparison. When the user asked for a
   demo, preview, or confirmation of a single artifact (nothing to choose
   between), a single variant is acceptable — the sticky-note layer is the
   point, not the plurality. Each variant root carries
   `data-variant="variant-x"` and
   `data-variant-label="<display name in user's language>"`. Proposal
   variants must state their **intent** and **tradeoff** in one short line
   each; a single-variant demo may omit the tradeoff line.
4. **`data-ref` coverage.** Every UI element the user might comment on gets
   `data-ref="<variant>.<section>.<element>"` (e.g. `variant-b.header.cta`).
   Granularity: buttons, inputs, nav items, cards, headings. These become
   note anchors and the semantic context when interpreting JSON — skipping
   them directly degrades the round trip.
5. **Embed the feedback layer.** Paste the contents of
   `assets/feedback-layer.js` **verbatim, unmodified** into a `<script>` just
   before `</body>` (after the optional `DFB_LABELS` block). The layer is the
   single source of truth for note UI appearance and behavior; never
   re-implement or override it in the proposal. Keep proposal `z-index`
   below 2147483000 and reserve 90px bottom padding on `body` so the toolbar
   doesn't cover content.
6. **Round 2+ starts with a response log.** For each note from the previous
   JSON, list either "✔ addressed (how)" or "− skipped (why)" before showing
   the new variants.
7. After generating, open the file with the OS-appropriate command
   (`open` / `xdg-open` / `start`), tell the user — in their language — to
   place notes and press Copy, then paste the JSON into the CLI. Then wait.

The visual design of the variants themselves is free per issue (combine with
the frontend-design skill if available). Mocks are decision material:
prioritize clear *differences between variants* over polish within one.

## Feedback layer spec (reference)

Use this when explaining the UI to the user or answering questions about it:

- Toolbar (fixed, bottom center): **Start/Stop feedback** toggle, note type
  (good / change / question, feedback mode only), **variant adoption**
  buttons (always visible so the settled choice stays readable in view mode,
  but changeable only during feedback), **Copy** (JSON to clipboard),
  **Save** (downloads `feedback-<issue>-r<n>.json`).
- In feedback mode: the proposal underneath is inert; clicking places a note
  at that point. Notes can be edited/deleted only in this mode, and can be
  **dragged by their header** to move — the note re-anchors at the drop
  point. **Copy and Save are disabled** during feedback mode to prevent
  exporting a half-finished state; the user must stop feedback first, which
  makes retrieval a deliberate finalizing step. Esc returns to view mode.
- In view mode: the proposal is fully interactive (for checking hovers etc.);
  notes are read-only.
- Note anchoring: nearest `data-ref` ancestor plus a relative offset; falls
  back to a CSS path when no `data-ref` is nearby.
- localStorage persistence is best-effort. The authoritative retrieval path
  is the Copy/Save buttons.

## Interpreting feedback

The JSON the user pastes:

```json
{
  "issue": "nav-redesign",
  "round": "1",
  "generated": "proposal-nav-redesign-r1.html",
  "chosen": "variant-b",
  "timestamp": "2026-07-16T09:30:00.000Z",
  "notes": [
    { "anchor": "variant-b.header.cta", "offset": [0.7, 0.2],
      "type": "change", "text": "Make this stand out one level more" },
    { "anchor": null, "fallback": "main > section:nth-of-type(1)",
      "offset": [0.5, 0.1], "type": "good", "text": "This density is right" }
  ]
}
```

Rules:

- Non-null `chosen` means that variant is the adopted direction. `good` notes
  on *other* variants indicate elements to fold into the adopted one.
- `anchor` encodes `variant.section.element`. Identify **which element of
  which variant** each note targets and reference that context explicitly in
  replies and in the next round.
- A note with `anchor: null` and only a `fallback` points outside the
  `data-ref` coverage. Infer the target from the selector and offset; if
  unsure, ask the user.
- `type` semantics: `good` = preserve in the next round / `change` = revision
  request / `question` = a question about intent or implementation —
  **answer it first**, before generating any next round.
- `chosen: null` with several change/question notes signals another round,
  not settlement. State a response plan for every note, then generate r(n+1).
- Zero notes with only `chosen` set is the fastest settlement: proceed with
  the adopted variant without further confirmation.

## After settlement

Once a variant is adopted, the proposal HTML has served its purpose as a
planning artifact. Hand off to implementation by translating the adopted
variant's structure, tone, and decision rationale into normal text or code;
that handoff is outside this skill's scope. You may offer to keep the
proposal HTML and feedback JSON in the repository if the user wants a record,
but Git management is not assumed.
