# 0003 — No seeded or stationary data, anywhere

**Date:** 2026-08-22
**Status:** Accepted

## Context

The design render carries a worked example throughout: Greenfield High, Block B;
a first-aid kit in the corridor; safety officer Amina O.; a nearest hospital
open 24 hrs; emergency number 999. Session 01 deferred a change-list item (A5)
about whether to re-dress that example as a Gulf school or a Msheireb worksite.

Asked to choose, the project owner rejected the premise: **no seeded, no
stationary information.** Contextual data is to be real data, and it is the
last part of the build.

## Decision

No contextual value may exist as a literal in application source. That means
the site, the building or zone, the first-aid kit location, the safety officer,
the nearest hospital and its hours, and — most importantly — **the emergency
number** all come from a store, read at runtime, passed to components as data.

`999` does not appear in `apps/web/src`. Neither does any site or person name.

Population of that store is the **final** build step, not the first.

## Why

Two reasons, and the second is the load-bearing one.

The presentational reason: seeded example data has a way of surviving into
production. A hard-coded `999` is correct in Doha and wrong everywhere else,
and it is exactly the kind of literal that is copied forward for years.

The safety reason: **a wrong emergency number is worse than a missing one.** If
the store has no number, the correct behaviour is a loud, visible "not
configured" state that a human notices immediately — never a plausible-looking
default that a frightened person will dial. Placeholder data in an emergency
tool is not a convenience; it is a failure mode that looks like success. This is
the same principle the project already learned elsewhere: a reassuring surface
over absent data is the dangerous case, because it is indistinguishable from
the working one.

Building the app before the data also proves the abstraction is real. If every
screen is developed against an empty store, nothing can quietly depend on a
value being present.

## Consequences

- A `site_context` store and a `GET /api/context` endpoint; components take
  context as props and have no fallback literals.
- Every context-dependent surface has an explicit unconfigured state. The
  emergency-dial control is **disabled** and says so when no number is stored —
  it never renders a guess.
- CI greps `apps/web/src` for emergency-number patterns and known context
  literals and fails the build on a hit.
- The Qatar dressing in `design/SANA_AI.html` is unaffected — that is the
  design artefact, not the app, and `tools/qatar_dressing.py --check` continues
  to guard it.

## Related

- `docs/decisions/0002-spec-version.md`
- `docs/SANA_Design_ChangeList_Qatar.md` §A5 (the deferred item this supersedes)
