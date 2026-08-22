# 0004 — The LLM may pass ids and observations, never prose

**Date:** 2026-08-22
**Status:** Accepted

## Context

Section 3 of the master prompt makes two demands that are easy to state and
hard to guarantee: SANA must never diagnose, and **no medical content may come
from model weights.** Section 7 scopes the model to "language and orchestration
ONLY, never medical authorship."

A prompt instructing a model not to author medical text is not a guarantee. It
is a request, and it fails silently — the failure looks like a fluent, helpful,
confidently wrong sentence read aloud to someone kneeling over a casualty.

## Decision

The model is confined behind a boundary that makes medical authorship
**unrepresentable** rather than merely forbidden. Its response is structured
output, temperature 0, conforming to exactly:

```ts
{ observed_facts: string[], candidate_protocol_id: string | null, confidence: number }
```

Validation at the boundary:

- `candidate_protocol_id` must be a member of the frozen library's id set, or
  `null`. Anything else is rejected outright.
- `observed_facts` are echoes of what the caller reported. They are recorded in
  the incident log and shown as "noted so far". They are **never spoken as
  guidance**.
- `confidence` below threshold, or a `null` id, yields `UNMATCHED`.

**No free-text field crosses the boundary into anything the user sees or
hears.** Spoken output is drawn only from the frozen library — including the
UNMATCHED line ("I can't match this — call for help now"), which is a library
asset with its own hash, not a string the model produced.

Access is through an `NluProvider` interface so the vendor is a one-file
decision.

## Why

This converts a policy into a property. With no prose channel, a model that
hallucinates a treatment has nowhere to put it: the field does not exist, and
an invented protocol id fails set-membership against the library. The failure
mode degrades to `UNMATCHED`, which is the behaviour Section 3 already
prescribes for uncertainty — do not guess, tell the human to call for help.

It also keeps the recitation rail honest. Because steps are fetched by id from
a content-addressed library and played as pre-recorded audio, "faithful
recitation" is not a behaviour anyone has to verify by listening; text that
drifts from its audio fails the library hash and the API refuses to boot.

## Open

The master prompt names **"GPT-5.6 Luna Pro"** as the orchestration model. That
is not a model this build can verify exists, so it is not wired to anything
yet. The default recommendation is Claude via the Anthropic SDK, which supports
the strict structured output this boundary depends on. Needs an owner decision
and an API key before Day 5.

Whatever is chosen, it must support schema-constrained output. A provider that
can only return free text cannot satisfy this decision and must be rejected.

## Related

- `packages/protocols` — the frozen, content-addressed library
- `packages/flow` — the state machine that owns MATCHING → CONFIRMING
