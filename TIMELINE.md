# SANA — Project Timeline

An append-only record of the project, one dated paragraph per working session.
Newest entries at the bottom. This file is the narrative; git history is the detail.

---

## 2026-08-20 → 21 — Session 01: repo stood up, design dressed for Qatar

SANA began tonight as a repository holding one LICENSE and a design that lived
as a loose file in Downloads. The first session did two things. First, it gave
the project a home: `C:\Users\SPECTRE\SANA` cloned from
`github.com/kipruto-hue/SANA`, with the Claude Design export committed as
`design/SANA_AI.html` so the five-screen design is versioned rather than
floating, and the master prompt filed as `docs/SANA_Master_Prompt.md` as the
single source of truth. Second, it applied the Qatar dressing change-list ahead
of the 28 August investor demo. The design had been drawn for a British-school,
Kenya-adjacent context: emergency number 112, "A&E", a "warden", a Nigerian
phone number. All of that is wrong in Doha. The bundle turned out to be a
single-line JSON-encoded template sitting next to a base64 asset blob that also
contains the digits "112" — so a global find-and-replace would have quietly
corrupted the file. Instead the edits went through `tools/qatar_dressing.py`,
which touches only the template line, asserts an exact expected count for every
substitution, proves its own encode/decode round-trip is byte-identical before
writing, and sweeps for stale strings afterwards. Nineteen instances of 112
became 999, A&E became hospital/ER (24 hrs), warden became safety officer, the
+234 number became +974. The substantive change was not cosmetic: the render had
jumped straight from listening into "step 1 of 3", skipping the
confirm-before-guiding beat that the master prompt makes non-negotiable. A
confirm block — SANA states the suspected match, the human taps Continue or
"Not right?" — was inserted above the step card in all three guidance renders,
so the human owns the match on screen as well as on paper. Site dressing (the
Gulf worksite / heat-collapse framing) was deliberately deferred; the Turn-1
direction screens were kept and swept along with everything else.

---

## 2026-08-22 — Session 02: the build begins, and the design stops being pasted

Six days out from the QDB demo, SANA stopped being a specification and started
being a system. The session opened by settling three questions that would
otherwise have been decided badly by default. First, the palette: the master
prompt describes a teal-and-coral app (`#0E7C74` / `#EF6A4C`), but the design
that was actually drawn, approved, and Qatar-dressed is a warm sand, terracotta
and olive system (`#f5ead8` / `#c67139` / `#7a8a5e`). The render wins — it is
what reviewers will see — so Section 6 of the master prompt is amended to
describe the app that exists rather than one that never did. Second, the spec
version: the master prompt pasted in this session supersedes the repo copy,
which means the flow returns to the six screens of Section 5 and the named
"site profile" concept is dropped. Third, and the one with the longest reach:
**no seeded or stationary information anywhere.** No hard-coded site, hospital,
safety officer, or emergency number. `999` is data, not a constant, and the
contextual store is populated last — so a missing value shows as "not
configured" rather than quietly rendering a plausible lie.

The other correction was to how the frontend gets built. Last session's design
arrived as a render and went in as a render. That is the thing not to repeat.
The bundle turns out to already carry a real design system — full neutral,
accent and accent-2 ramps, radius and space scales, Figtree and Caprasimo, and
a component vocabulary defined as CSS classes (`btn` with five variants, `card`
with kicker/title/meta/body, `dialog`, `tag`, `input`, `radio`, `seg`, three
elevation levels). So the design reaches the app by deterministic extraction —
a tool that reads the bundle's JSON template line and emits tokens, with a
`--check` mode so drift fails CI — and then as hand-built React primitives.
Never by copying markup.

The architecture makes the Section 3 safety rails structural rather than
aspirational: a frozen, content-addressed protocol library whose hash the API
refuses to boot without; a flow state machine whose transition table makes it
impossible to reach GUIDING except through a human confirmation, and impossible
to reach ESCALATED except through a human tap; an LLM boundary across which
only protocol *ids* and observed facts may pass, never prose, so no medical
wording can originate in model weights; and an incident record derived purely
from the append-only event log rather than authored by anything. Escalation has
no server-side implementation at all — there is nothing that could auto-dial.

**State at the midday pause.** Five commits pushed, working tree clean, `npm
run verify` green across all five guards. What exists now: the reconciled
master prompt and four decision records; `tools/extract_tokens.py`, which pulls
48 tokens, 13.7KB of component CSS and four real woff2 files out of the design
bundle and fails CI on drift; and the frozen protocol library — three
protocols, twenty-two steps, eight locked system lines, all `clinician_review:
pending`, content-addressed so edited medical content cannot run. Seventeen
tests green. Two defects were caught and fixed along the way, both of the kind
that only surface on someone else's machine: `.gitattributes` rule ordering had
silently re-enabled CRLF conversion on the design bundle — the exact corruption
session 01 guarded against, and 392 CRs had already landed in the working copy —
and the generated design-system files needed the same LF pinning, or the drift
check would have failed on every fresh clone while the design was untouched.
What does not exist yet: any running application. There is no `apps/` directory,
no frontend, no server. The next session starts the flow state machine, which
everything downstream drives off.

---

## 2026-08-23 — Session 03: opening state

Two entries close out session 02, which ran past the midday pause the record
above describes. The app got built: `apps/web` as a Vite + React workspace, the
flow state machine in `lib/flow.ts` with its transition table under test, the
frozen library read through `lib/library.ts`, the contextual store in
`lib/context.ts` populated last so unset values read as "not configured", voice
in and out through `lib/speech.ts` (browser recognition, so nothing leaves the
device; synthesis reading locked library text only, standing in for the
pre-recorded Chatterbox audio), and the five screens — Welcome, Consent,
Standby, Live, Handover — assembled in `App.tsx` as one page. Then SANA got its
voice: `lib/copy.ts` centralises every user-facing string so the wording lives
in one reviewable place rather than scattered through JSX, and the screens were
rewritten against it, with two things the earlier record had wrong corrected in
passing.

The session opens with the tree clean, `main` level with `origin/main` at
`4a66ccf`, and `npm run verify` green end to end: token drift check, Qatar
dressing check, typecheck across both projects, lint, and 28 tests across two
files (17 protocol-library, 11 flow). Five days to the QDB demo. What still
does not exist: any server or API — the frozen-library hash gate the
architecture calls for has no boot to refuse, since escalation deliberately has
no server-side implementation; the real Chatterbox audio, still stood in for by
browser synthesis; and the incident record derived from the event log. Nothing
has run in front of a reviewer yet.

---

## 2026-08-24 — Session 04: opening state

The project resumes with nothing lost since session 03 closed: the tree is
clean, `main` sits level with `origin/main` at `a6c0289`, and `npm run verify`
runs green end to end — token drift check, Qatar dressing check (all seven
dressed strings at their expected counts), typecheck across both projects,
lint, and 28 tests across two files (17 protocol-library, 11 flow). What exists
today is the whole front half of SANA: the reconciled master prompt and four
decision records; `tools/extract_tokens.py`, which deterministically pulls the
design system out of the Claude Design bundle and fails CI on drift; the frozen,
content-addressed protocol library of three protocols and twenty-two steps, all
still `clinician_review: pending`; and `apps/web`, a Vite + React single page
carrying the five screens — Welcome, Consent, Standby, Live, Handover — driven
by the `lib/flow.ts` state machine whose transition table makes GUIDING
reachable only through a human confirmation and ESCALATED only through a human
tap, with voice in and out via `lib/speech.ts` and every user-facing string
centralised in `lib/copy.ts`. What still does not exist, four days out from the
QDB demo on 28 August: any server or API, so the frozen-library hash gate has no
boot to refuse; the real pre-recorded Chatterbox audio, still stood in for by
browser speech synthesis; the incident record derived from the append-only event
log; and a single run-through in front of a reviewer.

---

## 2026-08-27 — Session 05: opening state, one day out

SANA resumes on the eve of the demo. Nothing moved since session 04 opened
three days ago: the tree is clean, `main` sits level with `origin/main` at
`5330313`, and `npm run verify` runs green end to end — token drift check,
Qatar dressing check with all thirteen dressed strings at their expected
counts, typecheck across both projects, lint, and 28 tests across two files
(17 protocol-library, 11 flow). The front half of the system is finished and
holds: the reconciled master prompt and four decision records;
`tools/extract_tokens.py` pulling the design system deterministically out of
the Claude Design bundle and failing CI on drift; the frozen,
content-addressed library of three protocols and twenty-two steps, all still
`clinician_review: pending`; and `apps/web`, a Vite + React single page
carrying Welcome, Consent, Standby, Live and Handover, driven by the
`lib/flow.ts` transition table that makes GUIDING reachable only through a
human confirmation and ESCALATED only through a human tap, with voice in and
out via `lib/speech.ts` and every user-facing string centralised in
`lib/copy.ts`. What is still missing is the same short list session 04 named,
and the QDB demo is tomorrow: the incident record derived from the append-only
event log, which is the one gap a reviewer will actually see because Handover
is the last screen of the run; the real pre-recorded Chatterbox audio, still
stood in for by browser speech synthesis; any server or API, so the
frozen-library hash gate has no boot to refuse; and a single uninterrupted
run-through on the machine the demo will be given from. With one day left the
order is forced — event log and incident record first, then a rehearsal on the
demo device, then audio if the hours are there. The server is not demo-critical
and should be declared cut rather than half-built, since escalation has no
server-side implementation by design and there is nothing on the demo path that
needs a backend.

**Morning.** The master prompt arrived as architectural law — the pipeline
fixed in order and role, ten rules that must never break, and a sequenced plan
for the day — and is filed verbatim at `docs/SANA_System_Master_Prompt.md`,
winning over both the code and the older master prompt wherever they disagree.
Three of its premises turned out to need correcting before any code was
written, and two of those corrections came from the record this file keeps.
First, the morning's task was described as building the append-only log because
session 05's own opening paragraph said Handover had nothing real behind it.
That was wrong: the log existed, written by the reducer, and the sheet already
rendered a timeline from it. What it lacked was the three properties that make
a log a source of truth. It lived only in React memory, so a refresh
mid-incident destroyed it; it had no sequence numbers, so two events in the
same millisecond had no defined order; and the sheet composed its own prose
from live state and the current site context, which meant editing the site
today rewrote yesterday's incident — reconstruction, exactly what rule seven
forbids, done by a component instead of a model. All three are fixed:
`log.ts` owns the append-only rules and refuses at the storage boundary any
write that is not an append, `deriveHandover` is a pure function of the log
alone, and events now carry structured data so no fact is ever recovered by
parsing English back out of a sentence. The record also stopped flattering
itself — going back a step is recorded, so the sheet cannot tell a tidier story
than the one that happened.

Second, and larger: midday was scheduled as a run-through that would exercise
"the two live API calls", but neither existed. There was no Whisper call and no
model call anywhere in the repository; speech was the browser's own and protocol
selection was sixty lines of local cue scoring. Both were built. `nlu.ts` is now
a real boundary across which exactly two values travel — a protocol id that must
exist in the frozen library, and a number — assembled field by field so that a
model returning beautifully worded first-aid steps has them dropped unread, and
so that escalating, skipping the human confirmation or advancing a step are not
validated away but simply not expressible. Six adversarial tests hold it.
Decision 0005 records the two places this is deliberately stricter than section
1.2 allows: observed facts are re-derived on-device from the library's own cue
lists, so no model prose ever appears beside the medical decision the human is
about to make, and conversational glue stays on the eight locked system lines,
because the pause before guidance is precisely where a frightened person cannot
tell reviewed prose from generated prose. `stt.ts` gives SANA ears that detect
the language from the audio rather than from a setting or a downstream guess,
running the browser's recognition for live captions alongside a recording that
goes to Whisper when the turn ends. Where no provider is configured the whole
thing runs on-device and says so in the record, because a log silent about the
fallback would imply the model had been consulted and agreed.

Third, a smaller correction worth keeping: rule nine's offline promise is
narrower than it reads. Locked audio plays offline, but Whisper and the selector
both need the network, so the honest claim is that once a protocol is confirmed
the guidance keeps reading with no connection — not that SANA works offline.
Two guards earned their keep during the morning. The decision-0003 lint rule
rejected test fixtures using a real emergency number, which is exactly how a
plausible default reaches an app; they use an undiallable placeholder now. And
a test asserting that model wording never survives the boundary failed because
it looked for the phrase "back blows" — which is in the library's own reviewed
choking steps, and belongs there. Forty-eight tests green, production build
clean, five commits pushed.
