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
