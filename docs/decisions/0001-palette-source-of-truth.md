# 0001 — The design render is the palette's source of truth

**Date:** 2026-08-22
**Status:** Accepted

## Context

Two documents described SANA's colour and disagreed completely.

Section 6 of the master prompt specified a cool clinical palette: teal primary
`#0E7C74`, deeper teal `#063B38`, coral `#EF6A4C` for urgent controls, off-white
grounds, deep-teal ink `#13322F`.

`design/SANA_AI.html` — the Claude Design export that was drawn, reviewed,
approved, and then Qatar-dressed in session 01 — is a different system
entirely: warm sand ground `#f5ead8`, raised surface `#ebddc5`, olive
`#7a8a5e` as the calm primary, terracotta `#c67139` as the urgent accent,
near-black ink `#201e1d`, Figtree body and Caprasimo headings.

Not a drift of a shade or two. A different brand.

## Decision

**The design render wins.** The app is built from the tokens in
`design/SANA_AI.html`. Section 6 of the master prompt is amended to describe
those colours.

## Why

The render is what the QDB reviewers will actually see on the 28th, and it is
the artefact that has already had a human design pass — including the Qatar
dressing and the confirm-before-guiding correction. The teal palette exists
only as prose; no one has ever seen it. Building to the prose would mean
throwing away approved visual work six days before a demo to chase a version
of the product that has never been rendered.

Amending the document is also the honest direction of the fix. A spec that
describes an app which does not exist is worse than no spec: it silently
invites every future contributor to build the wrong thing.

## Consequences

- Section 6 and the Section 9 compressed prompt now name the warm palette.
- The tokens are **generated**, never transcribed: `tools/extract_tokens.py`
  reads the bundle and emits `packages/tokens/`. A `--check` mode fails CI when
  the app and the design drift apart, which keeps the render upstream rather
  than letting it become a stale reference.
- The master prompt's semantic rule survives the colour change intact: there is
  exactly one "a human must act here" colour, reserved for the emergency-dial
  control. Only its value changes — coral becomes terracotta `#c67139`. That
  reservation is enforced by a test, not by discipline.

## Related

- `docs/decisions/0002-spec-version.md`
- `design/SANA_AI.html`, `tools/qatar_dressing.py`
