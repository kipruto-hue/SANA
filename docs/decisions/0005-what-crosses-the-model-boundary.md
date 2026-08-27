# 0005 — Only an id and a number cross the model boundary

**Date:** 2026-08-27 (session 05)
**Status:** accepted, and deliberately narrower than the spec permits
**Supersedes nothing.** Implements master prompt section 1.2.

## Decision

`crossBoundary` in `apps/web/src/lib/nlu.ts` reads exactly two values off the
selector's response: a **protocol id** that must exist in the frozen library,
and a **confidence** that must be a finite number in [0, 1]. It builds its
result field by field rather than passing an object through, so nothing else in
the response is reachable from anywhere downstream.

Section 1.2 also permits the model to return **observed facts** and
**conversational glue**. Neither is taken. Both exclusions are decisions, not
oversights, and both can be reversed by widening one function.

## Why observed facts are re-derived on-device

The confirm screen is where the human owns the match — they read what SANA
thinks it heard and decide. Every word on that screen should trace either to
reviewed content or to the human's own speech.

If the observed cues came from the model, model prose would sit directly beside
the medical decision a frightened person is about to make, in the one place the
whole architecture exists to protect. So `cuesFor` intersects the transcript
with the library's own `match_cues` instead. The facts shown are what the
*library* recognises.

## Why conversational glue stays on the locked system lines

`_system.json` already holds eight glue lines — acknowledge, thinking,
unmatched, not_right, step_done, protocol_complete, escalation_confirmed,
no_emergency_number — hashed and frozen exactly like medical content, because
the sentence SANA says when it cannot match is as safety-critical as any step.

Letting a model write those sentences would put generated prose in the pause
before guidance: the moment a frightened person is least able to tell the
difference between a sentence that was reviewed and one that was produced. The
glue costs nothing to keep locked, and the demo gains nothing from varying it.

## What this buys

- A hallucinated protocol id selects nothing, rather than selecting something.
- Medical wording in the response is dropped unread, under any field name.
- There is no field a model could set to escalate, to skip the human
  confirmation, or to advance a step. Those are not validated away — they are
  simply not expressible in what crosses.

Six adversarial tests in `nlu.test.ts` hold this.

## What it costs

Multilingual glue. When Whisper detects a language the locked lines are not
written in, SANA has no glue to speak in that language, because the lines are
frozen English. That is a real limit and the honest place for it is the
protocol library — new locked lines, reviewed — not the model.

## Note on falling back

With no provider configured, or when the selector is unreachable, the on-device
matcher runs and the fallback is **recorded** (`selector` event). A record that
stayed silent would imply the model had been consulted and agreed. Falling back
is not a degraded mode: the worst case is that SANA fails to match and says so,
which is what the safety rails require anyway.
