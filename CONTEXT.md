# visual-dialogue

The domain of this repo is a Claude Code skill and its **token economy** — the
cost of the skill being present versus the cost of it running.

## Language

**Description field**:
The `description:` in `SKILL.md`'s frontmatter. Its sole job is the **trigger
judgment** — deciding whether the skill fires. It is [[always-on cost]], so
behavioral guidance does not belong here.
_Avoid_: description text, blurb.

**Body**:
Everything in `SKILL.md` after the frontmatter. Governs [[behavior]] once the
skill has fired. It is [[on-invoke cost]] — free until the skill runs.

**Always-on cost**:
Tokens loaded into every session regardless of use. For a skill, only the
[[description field]] incurs this.
_Avoid_: startup cost, static cost.

**On-invoke cost**:
Tokens loaded only when the skill fires (the [[body]]) or when an asset is
referenced (`template.html`, `feedback-layer.js`). Zero until triggered.
_Avoid_: runtime cost, lazy cost.

**Trigger**:
A condition in the [[description field]] under which the skill should fire.
Split into user-driven (the user asks to see/compare) and **self-trigger**
(Claude itself is about to make a proposal that must be judged by eye).
_Avoid_: activation, invocation cue.

**Self-trigger**:
A [[trigger]] where Claude fires the skill on its own initiative rather than in
response to an explicit request. Non-obvious — models under-fire on these — so
it earns its place in the [[description field]] where a user-driven synonym
list does not.

**Behavior**:
How the skill acts *after* firing (proportionality full/offer/skip, the
round-trip workflow, feedback-JSON interpretation). Belongs in the [[body]],
never the [[description field]].
