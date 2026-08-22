# 0002 — The supplied master prompt supersedes the in-repo revision

**Date:** 2026-08-22
**Status:** Accepted

## Context

Two revisions of the master prompt existed.

The in-repo copy at commit `f9c14cd` had rewritten Section 5 during session 01
to describe the five screens the design render actually proved — Consent gate,
Ready/standby, Live conversation, Handover sheet, Sessions — and had promoted
two ideas the render introduced into named concepts: a **site profile** (the
per-site store of building, kit location, safety officer, nearest hospital and
local emergency number) and **sessions/history with incident filing**.

The project owner supplied the original revision at the start of session 02 and
designated it authoritative. Its Section 5 lists six screens (Welcome/Login +
Consent, Home/Standby, Active Emergency, Confirm, Incident Record, plus a
[LATER] bucket) and names neither concept.

## Decision

**The supplied revision governs.** It replaces `docs/SANA_Master_Prompt.md`
wholesale, with one amendment carried forward (the palette — see 0001).

The *Sessions* screen and the named *site profile* concept are withdrawn from
the demo scope.

## Why

The owner is the authority on scope, and said so explicitly. The withdrawn
items are also the right things to drop under a six-day deadline: Sessions is a
history browser that the core demo loop never touches, and the demo shows one
incident, live, from start to handover.

## Consequences

- The build targets six screens, not five. The *Handover sheet* survives as
  screen 5, *Incident Record / Handoff* — same artefact, the spec's name.
- Dropping the *name* "site profile" does **not** reinstate hard-coded
  contextual data. The opposite: decision 0003 requires all of it to be stored
  and populated last. The concept the render needed survives as a plain data
  store; only the ceremony around it is gone.
- Should Sessions be wanted after the demo, the append-only incident event log
  built on Day 2 already contains everything it would need. Nothing is
  foreclosed.

## Related

- `docs/decisions/0001-palette-source-of-truth.md`
- `docs/decisions/0003-no-seeded-data.md`
