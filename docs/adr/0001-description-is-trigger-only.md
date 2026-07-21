# The SKILL.md description is trigger-only

The `description:` frontmatter is the only part of a skill loaded into **every**
session (always-on cost); the body loads only when the skill fires. So the
description's sole job is the *trigger judgment* — deciding whether to fire —
and all post-fire behavior belongs in the body. On that basis we cut the
description from ~1,470 to ~533 chars (~490 → ~180 tokens): folded the
exhaustive user-phrase list to one or two representative cues, deleted the
object enumeration (UI/layout/mockup/diagram/…) by absorbing it into the single
heuristic "if your reply would describe look-and-feel in prose, that is the
signal to fire", and removed the proportionality/offer guidance since the body's
"Proportionality" section already holds it in full.

## Considered Options

Keeping exhaustive trigger lists "for reliability" was rejected: the reading
model generalizes from the core concept, so enumerated synonyms are redundant
always-on cost. See sibling skills (`grilling` ~150 chars, `domain-modeling`
~214) for the house style — one "what it is" sentence plus a short "use when".

## Consequences

The trade-off is trigger reliability vs. token cost, and it is asymmetric: this
skill has a **self-trigger** (Claude fires on its own initiative), which has no
user keyword to catch and now rests entirely on the look-and-feel heuristic. If
description-style replies start slipping past unfired, the minimal fix is to
restore one or two object examples into that heuristic — not the full list.
