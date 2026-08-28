**The upgrade.** All four pieces landed. `_responses.json` joined the library as
a third locked file — six intents, hashed into the same manifest, behind the
same clinician-review gate, passing the same no-diagnosis guard as a medical
step. One thing the brief could not have known: `readAndHashContent` parsed
every content file that was not `_system.json` as a protocol, so dropping the
new file in would have failed the build on the first read; it needed its own
branch, and `isFullyReviewed` now counts it, because SANA speaking a
reassurance nobody reviewed is the same class of problem as SANA speaking a
step nobody reviewed. `crossIntentBoundary` mirrors `crossBoundary` and returns
a bare string, so there is not even an object for stray wording to travel
inside. The listening loop lives in `Live.tsx` and switches itself on from
whether the reply audio exists rather than from a setting — a conversational
SANA that listens and then says nothing is worse than the stepper it replaces,
and nobody should have to remember a switch on the morning of a demo.

The one design decision worth recording separately is in decision 0006:
`awaiting_response` is a boolean inside `guiding`, not a new `Phase`. The whole
safety architecture rests on `guiding` being reachable only through
`HUMAN_CONFIRMED`, and a new phase value would put a row in the transition table
directly beside it that every future edit would have to re-prove; a flag nested
inside a phase cannot weaken the property it is nested inside. In the same
spirit, `ready` advances by dispatching the exact action the Next button
dispatches, and a test asserts both paths land on an identical state — because
if voice moved the step itself there would be two paths through the guidance,
and the second would be the one nobody was watching.

Twenty-five new tests, seventy-three in total. They ask one question in several
ways: can speaking to SANA reach anything tapping could not. It cannot — voice
cannot start guidance from any earlier phase for any of the six intents, though
a reply spoken outside guidance is still written down rather than lost. Two
lint rules improved the design rather than merely passing: `setState` in an
effect and a memo that could not be preserved both pointed at the on-screen
reply being component state, so it is derived from the log now, like the
handover sheet. And the handover carries the conversation — what was said, how
it was understood, and which step it happened on. Distress and new reports
appear as facts with times against them, never summarised into a mood or a
severity, because SANA describing the operator as panicking would be an
assessment; a test asserts the sheet contains no such adjective. Two things
still gate the payoff, both outside the code: with no LLM configured every
reply classifies as `unclear` and voice never advances, and until Fish Audio
renders the reply lines the loop stays off. Until both land, SANA remains
exactly the stepper that already works.
