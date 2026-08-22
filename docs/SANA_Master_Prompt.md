# SANA — MASTER PROMPT & FRONTEND ARCHITECTURE SPEC
### The single source of truth for building SANA's demo frontend and its end-to-end flow

> **Version note (2026-08-22).** This document is the authoritative master
> prompt as supplied by the project owner. It supersedes the earlier in-repo
> revision (commit `f9c14cd`), which had rewritten Section 5 to a five-screen
> list and introduced a named "site profile" concept. Those are withdrawn.
>
> **One deliberate amendment:** Section 6's palette has been corrected to the
> colours the approved design actually uses. Everything else is as supplied.
> See `docs/decisions/` for why.

---

## 0. HOW TO USE THIS DOCUMENT

This is the master prompt. Hand it to any builder — Claude Design, a developer, or a code-generation tool — as the authoritative description of what SANA is, how it must behave, and what to build. Every rule here is deliberate. The **safety rails in Section 3 are non-negotiable**: they are the entire reason SANA is safe to deploy and fundable. A build that omits them is wrong, no matter how polished it looks.

Scope of this prompt: the **v1 demo frontend** and the **flow logic** it drives. It targets the 28 August investor demo — a working slice, not the finished product. Where something is out of scope for the demo, it is marked **[LATER]**.

---

## 1. WHAT SANA IS (ONE PARAGRAPH THE BUILD MUST NEVER CONTRADICT)

SANA is a calm, voice-first companion for the minutes before professional help arrives in a medical emergency. A frightened bystander speaks to it; it identifies the right **vetted, clinically-reviewed first-aid protocol**, confirms that match with the human, and reads the steps aloud one at a time — until help arrives. It then produces a clean, timestamped **incident record** for the responder. SANA **never diagnoses, never guesses, and never invents medical content.** It is an informational tool that bridges a gap in time; it does not replace doctors or emergency services — it extends them.

---

## 2. CORE PRINCIPLES (THE SPINE)

1. **Voice-first.** A panicking person cannot read or navigate menus. The primary interaction is speaking and listening. Visuals support the voice; they never replace it.
2. **Calm is the product.** Tone, pacing, and reassurance are features, not decoration. Slower speech, short sentences, steadying language ("I'm here", "you're doing fine", "well done").
3. **Vetted content only.** Every spoken medical step comes from a frozen, human-reviewed protocol library. The AI reads locked scripts; it does not generate the medical wording.
4. **The human decides.** SANA confirms the situation with the human and the human chooses to escalate. SANA never makes those two calls alone.
5. **Everything is logged.** Every event is timestamped for the handoff record and the audit trail.
6. **Data flows outward, never back.** Incident data goes to responders, audit, and (anonymized) insight. It NEVER feeds back into changing what SANA says.
7. **Privacy by design.** Collect the minimum. Store the incident, not the identity, wherever possible. Explicit consent for health data. Guardian consent for minors.

---

## 3. SAFETY RAILS — NON-NEGOTIABLE (BUILD MUST ENFORCE THESE)

- **SANA never names a cause / never diagnoses.** It responds only to observable facts the user reports (breathing? conscious? bleeding?). No "this is probably X because Y."
- **Confirm before guiding.** Before reading any protocol, SANA states the suspected match and requires the human to confirm: *"This sounds like a seizure — is the person shaking and unresponsive? Say yes and I'll walk you through it."* The human owns the match.
- **Faithful recitation.** The medical steps are played from **pre-approved, locked scripts / pre-recorded audio.** The AI must NOT paraphrase, summarize, reorder, or improvise the medical steps. It reads them as written/reviewed.
- **Human-owned escalation.** A large, always-visible **CALL FOR HELP** control. SANA surfaces and offers it; the human taps it. SANA never auto-dials or auto-escalates.
- **Graceful uncertainty.** If SANA cannot confidently match a protocol, it does NOT guess. It says so plainly and directs the human to call for help immediately.
- **No medical content from model weights.** If the protocol library has no answer, SANA does not fill the gap from the LLM's own knowledge.

If any design or code choice conflicts with the six rules above, the rule wins.

---

## 4. END-TO-END FLOW (WHAT THE FRONTEND MUST DRIVE)

The frontend orchestrates this sequence. Each stage is a UI state.

1. **LOGIN & CONSENT** — User opens the app, authenticates (keep minimal for demo), selects language, and gives explicit consent to health-data capture. Guardian-consent path noted **[LATER]** for schools. Session starts.
2. **STANDBY / ACTIVATE** — A single, unmistakable primary action to start an emergency ("I need help" / large mic button). Reachable in one tap, one-handed.
3. **LISTEN (Speech → Text)** — User describes the situation by voice. Streaming transcription. Show live captions so the user sees they're being heard. Start an immediate audio acknowledgement ("Okay, I'm here—") so there is never dead silence.
4. **UNDERSTAND & MATCH** — The described facts are matched against the frozen protocol library (retrieval) to select a candidate protocol + confidence. (Model does language understanding + orchestration only.)
5. **CONFIRM (human decides)** — SANA speaks the suspected protocol and asks for a yes/no confirmation. UI shows the suspected protocol name + a clear confirm/deny. If denied, re-ask or offer options.
6. **GUIDE ALOUD** — On confirmation, play the **pre-recorded, reviewed** protocol steps one at a time (TTS/audio files). Wait for "done"/"next" between steps. Show the current step as large text alongside the audio. Keep pacing calm.
7. **ESCALATE (human decides)** — CALL FOR HELP is visible throughout. On tap, dial emergency services and surface the incident summary for the user to read to the responder.
8. **HANDOFF & LOGS** — A timestamped incident record is generated automatically (onset, observed signs, protocol used, steps confirmed, actions taken, escalation). Ready to hand to the responder / export. Feeds audit + anonymized insight — **never back into guidance.**

---

## 5. SCREENS TO BUILD (v1 DEMO)

1. **Welcome / Login + Consent** — brand, one-line mission, language picker, explicit consent toggle, "Start" / auth.
2. **Home / Standby** — one giant primary "I need help" action; small, calm secondary info.
3. **Active Emergency (the core screen)** — live captions, current SANA state (listening / confirming / guiding), the current step in large text, a persistent CALL FOR HELP button, a subtle "SANA is recording this incident" indicator.
4. **Confirm modal/state** — suspected protocol name, plain confirm/deny.
5. **Incident Record / Handoff** — the timestamped summary, readable and exportable, with the "read this to the responder" framing.
6. **[LATER]** Protocol library admin, multi-language management, institutional dashboards, PharmaScan.

---

## 6. VISUAL & INTERACTION DESIGN

**Brand & tone.** Calm, trustworthy, clinical-but-human. Not alarming, not sterile. It should feel like a steady professional, not a flashing alarm.

**Palette (SANA brand).** *Amended 2026-08-22 to match the approved design — see `docs/decisions/0001-palette-source-of-truth.md`.* The system is warm and earthen, not clinical-cool. Values are the canonical tokens in `design/SANA_AI.html`; they reach the app only via `tools/extract_tokens.py`, never by hand.

- Ground: sand `#f5ead8` (`--color-bg`), raised surface `#ebddc5` (`--color-surface`)
- Primary / calm: olive `#7a8a5e` (`--color-accent-2`), with a full 100–900 ramp
- Urgent: terracotta `#c67139` (`--color-accent`), with a full 100–900 ramp
- Ink: near-black `#201e1d` (`--color-text`); muted text from the neutral ramp (`--color-neutral-600/700`)
- **Terracotta is the "a human must act here" colour.** It is reserved for the emergency-dial control. Nothing else spends it — this is enforced by a test, not by discipline.

**Typography.** Figtree for body (`--font-body`), Caprasimo for headings (`--font-heading`). Oversized, high-contrast text on the Active Emergency screen — a scared person reads at arm's length. Short lines. No dense paragraphs anywhere in the live flow.

**Layout & accessibility (critical — this is an emergency tool).**
- Huge tap targets. One-handed, one-tap reach for the primary action and CALL FOR HELP.
- Extreme legibility: large type, high contrast, minimal chrome during an emergency.
- The Active Emergency screen shows at most: current state, current step, captions, CALL FOR HELP. Nothing else competing.
- Motion is calm and slow. No jarring flashes. A gentle "listening" indicator, not a strobe. Honour `prefers-reduced-motion`.
- Works with audio as the primary channel; screen is the backup/confirmation.

**States the UI must express clearly:** Listening · Thinking/Matching · Confirming (needs human) · Guiding (step N) · Escalating · Recording (always, subtly) · Resolved.

---

## 7. WHAT LIVES WHERE (so the build's mental model is right)

- **On your servers (Vultr):** frontend hosting, backend/API, session state, the frozen protocol library (scripts + pre-recorded audio + retrieval index), and the incident log store (Postgres). EU/in-region hosting for regulated markets **[LATER]**.
- **External API calls:** Speech-to-text (e.g. Whisper), LLM orchestration/NLU (language & orchestration ONLY, never medical authorship), text-to-speech. **Demo note:** protocol audio is **pre-generated once with Chatterbox (MIT)** and simply played back — no live TTS call in the critical path for the demo.
- **The LLM is not a step on the spine.** It is the intelligence inside understanding, matching, and pacing. Medical content comes only from the library.
- **Contextual data is data.** The emergency number, the nearest hospital, the safety officer on duty and the site itself are **stored, not hard-coded**, and are populated as the final build step. No value of this kind may appear as a literal in application source — enforced in CI. See `docs/decisions/0003-no-seeded-data.md`.

---

## 8. DEMO SCOPE (FOR 28 AUGUST) — DON'T OVERBUILD

- **Languages:** English only for the demo. Architecture must treat language as a content layer (each protocol translated + voice-recorded once) so adding Arabic/Swahili is a content step, not a rebuild.
- **Protocols:** 3 end-to-end — **snakebite, fainting/unconsciousness, choking.** Scripts authored in SANA's own plain words from open evidence (WHO / IFRC / ILCOR facts) and clinician-reviewed. Audio pre-generated with Chatterbox.
- **Escalation:** one-tap dial + show the incident summary. Automated dispatch integration is **[LATER]**.
- **The demo must show, live:** speak → match → confirm → guided steps aloud → CALL FOR HELP → incident record generated. That single loop, done safely, is the whole demo.

---

## 9. THE COMPRESSED MASTER PROMPT (paste-ready for a builder / design tool)

> Build the frontend for **SANA**, a calm, voice-first emergency first-aid companion for the minutes before professional help arrives. A frightened bystander speaks; SANA identifies the correct **vetted, clinically-reviewed first-aid protocol**, **confirms the match with the human**, then reads **pre-approved, locked steps aloud** one at a time until help arrives, and generates a **timestamped incident record** for the responder.
>
> **Absolute rules SANA must enforce:** it NEVER diagnoses or names a cause (responds only to observable facts); it ALWAYS confirms the suspected protocol with the human before guiding; it reads medical steps **faithfully from locked scripts** and never paraphrases or invents them; **escalation is human-initiated** via an always-visible CALL FOR HELP control (SANA never auto-escalates); if it cannot confidently match, it does not guess — it tells the human to call for help. Everything is logged; incident data flows outward to responders/audit/anonymized insight and NEVER back into the guidance. Privacy by design: minimal data, explicit consent for health data, store the incident not the identity.
>
> **Flow / screens:** (1) Login + language + explicit consent; (2) Standby with one giant "I need help" action; (3) Active Emergency screen — live captions, clear state (Listening / Matching / Confirming / Guiding step N / Escalating / Recording), current step in oversized text, persistent CALL FOR HELP; (4) Confirm state (suspected protocol + yes/no); (5) Incident Record / handoff summary, readable and exportable.
>
> **Design:** calm, trustworthy, human — never alarming or sterile. Warm sand ground (`#f5ead8`), olive primary (`#7a8a5e`), terracotta (`#c67139`) reserved strictly for the emergency-dial control, near-black ink (`#201e1d`). Figtree body, Caprasimo headings. Oversized high-contrast type, huge one-handed tap targets, minimal chrome during an emergency, slow calm motion (no flashing). Audio is the primary channel; the screen confirms and supports it.
>
> **Demo scope:** English only; three protocols (snakebite, fainting, choking) with pre-recorded audio; one-tap escalation. Language is a content layer so more languages are added later without a rebuild. Show the full loop live: speak → match → confirm → guided steps → CALL FOR HELP → incident record.
>
> Do not add features that dilute the core loop. Do not let any visual choice override the safety rules above.

---

## 10. OPEN ITEMS TO RESOLVE (NOT BLOCKERS FOR THE DEMO)

- Clinician sign-off on the 3 demo scripts (required before saying "reviewed"). Until then the library marks them `clinician_review: pending` and the UI says so.
- Guardian-consent flow for the schools scenario.
- In-region hosting decision for regulated markets.
- Live TTS layer for dynamic confirm lines (demo can pre-record these).
- Kenya Red Cross partnership conversation (content authority + commercial-use path).
- NLU provider selection and API credentials (see `docs/decisions/0004-nlu-boundary.md`).
- Vultr deployment credentials.
