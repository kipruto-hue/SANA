# 0006 — Conversation is selected, never written

**Date:** 2026-08-28 (session 06)
**Status:** accepted
**Extends** decision 0005 to a second boundary. Overrules nothing.

## Decision

SANA listens between steps and answers by voice. Every sentence it says back
comes from `packages/protocols/content/_responses.json` — a third locked
library, six intents, hashed into the same manifest and gated behind the same
`clinician_review` as the medical content, passing the same
`noDiagnosisLanguage` guard.

The model's entire contribution is one id out of six. `crossIntentBoundary`
returns a **bare string**, so there is not even an object for anything else to
travel inside.

## Why `awaiting_response` is a boolean, not a `Phase`

The brief calls it a sub-phase. It is implemented as `awaitingResponse: boolean`
on `State`, meaningful only while `phase === 'guiding'`, rather than as a new
value in the `Phase` union.

The whole safety architecture rests on one sentence: `guiding` is reachable only
through `HUMAN_CONFIRMED`. A new phase value would add a row to the transition
table sitting directly beside `guiding`, and every future change to that table
would have to re-establish that the new row cannot be entered another way. A
flag nested *inside* a phase cannot weaken the property it is nested inside.

`conversation.test.ts` asserts the property directly: for every phase before
guidance, and for all six intents, a spoken reply cannot produce `guiding`.

## Why `ready` fires `NEXT_STEP` rather than moving the step itself

Advancing by voice dispatches the exact action the Next button dispatches. The
test asserts both paths land on an identical state — same `stepIndex`, same
`phase`, same `furthestStep`, same step event data.

If voice moved the step itself there would be two paths through the guidance,
and the second one would be the one nobody was looking at.

## Why a reply outside guidance is recorded but not acted on

Both halves matter. Acting on it would be a way into guidance. Discarding it
would mean the record quietly omits something the person said during an
emergency. So it is written to the log and changes nothing.

## The temptation this exists to refuse

Once SANA is listening, it will feel obvious to let the model write one custom
reassurance for the reply that fits no intent — just this once, for the case the
six do not cover.

Do not. Unmatched input gets the locked `unclear` line and the guidance holds
where it is. If the intent set turns out to be too small, the fix is a new
**locked, reviewed** line, never an open mouth. Conversation that is selected
rather than written is the entire moat; the first improvised sentence is the day
that stops being true.

`nlu.test.ts` encodes this: a model returning `reply`, `spoken_response`,
`reassurance` or `say` alongside a valid intent has all four dropped unread.

## Why reassurance is held to the medical standard

`_responses.json` carries no medicine. It is reviewed as if it did, for the same
reason `_system.json` already is: what SANA says to a frightened person mid-
emergency is safety-critical in its own right, and a warm sentence is precisely
where a clinical claim slips in unnoticed. *"Don't worry, it's probably just a
faint"* reads as kindness and is a diagnosis. The guard rejects it, and a test
proves the guard is live on this file.

One line deserves specific note. `panic` affirms the **person**, not the
outcome — "You're doing the right thing", never "they'll be fine". SANA cannot
know whether the casualty will be alright and must never imply it.

## What is not built

No on-device intent classifier. Protocol selection falls back to an on-device
matcher; intent classification does not, and lands on `unclear` instead. Holding
still and saying so is always safe here, and the buttons never stopped working —
so the fallback costs nothing that a wrong guess would not cost more.

The consequence, stated plainly: **with no LLM configured, voice never advances
a step.** Every reply classifies as `unclear`. The loop also only switches
itself on once the Fish Audio reply files exist, so until both land SANA remains
the stepper it already was.
