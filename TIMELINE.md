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
