# SANA — MASTER PROMPT & FRONTEND ARCHITECTURE SPEC
### The single source of truth for building SANA's demo frontend and its end-to-end flow

> **Revision 2026-08-21.** Section 5 now describes the five screens the Claude
> Design render actually proved out, rather than the earlier provisional list.
> Two concepts the design added — the **site profile** and **sessions/incident
> filing** — are now owned by this document (Sections 5, 5A, 7). Everything else
> is unchanged. The design bundle is `design/SANA_AI.html`; where this document
> and the design disagree, this document wins.

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
- **Confirm before guiding.** Before reading any protocol, SANA states the suspected match and requires the human to confirm: *"This sounds like a seizure — is the person shaking and unresponsive? Say yes and I'll walk you through it."* The human owns the match. Keep the beat light for low-risk protocols and explicit for higher-risk ones — but it must exist on screen and in audio, never be edited away for elegance.
- **Faithful recitation.** The medical steps are played from **pre-approved, locked scripts / pre-recorded audio.** The AI must NOT paraphrase, summarize, reorder, or improvise the medical steps. It reads them as written/reviewed.
- **Human-owned escalation.** A large, always-visible **CALL FOR HELP** control, which dials **the emergency number from the site profile** (999 in Qatar, 112 in Kenya/EU, 911 in the US — never hard-coded). SANA surfaces and offers it; the human taps it. SANA never auto-dials or auto-escalates.
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

These are the five screens the design proved out. Each exists in a **phone** and a **laptop** render; screen 3 additionally has a **text-first variant (2b)** for noisy or quiet rooms, where captions carry the screen instead of the voice orb.

1. **Consent gate** — five explicit acknowledgements before SANA will listen: it cannot diagnose, prescribe, or triage; in a life-threatening case call emergency services first; age/staff confirmation; microphone; recording + transcript. Consent is a **hard gate before first use**, not a dismissible notice. (Implements Section 4 stage 1 and the Section 7 privacy rules.)
2. **Ready / standby** — the resting state. One primary **"Hold to talk"** target, plus what the **site profile** knows: first-aid kit location, safety officer on duty, nearest hospital, and the local emergency number.
3. **Live conversation** — the core screen. The voice orb carries it; the last thing SANA said sits directly under it; **CALL 999** (from the site profile), *alert the safety officer*, and the "noted so far" observable facts stay one reach away. Includes the **confirm-before-guiding beat**: SANA states the suspected match and the human taps **Continue** or **Not right?** before any step is read. Guidance then appears one step at a time ("step 1 of 3").
4. **Handover sheet** — *What happened / Observed / Actions taken / **Not included** (no diagnosis, no severity) / Timeline*. Readable aloud to a paramedic, filable as an incident log to the site safety officer. Audio stays on the device. **This is the differentiator — keep it central.**
5. **Sessions** — history list plus the full transcript of any session picked from it. Each entry is labelled by what happened, where, and how it ended (e.g. *"Fainting, Block B corridor · Filed · 999 called"*). Delete removes the audio **and** the filed log.

**[LATER]** Protocol library admin, multi-language management, institutional dashboards, PharmaScan.

### 5A. TWO CONCEPTS THE DESIGN ADDED — NOW PART OF THE SPEC

- **Site profile.** SANA is deployed **per site** and knows that site: the building and its zones, where the first-aid kit is, who the safety officer on duty is and how to reach them, the nearest hospital and its hours, and the **local emergency number**. This is *why* the emergency number is dynamic (999 in the Qatar demo) rather than hard-coded, and it is what lets SANA say "the kit is in the corridor by Block B" instead of "find a first-aid kit". Bake it into the build as configuration, not content.
- **Sessions / history + incident filing.** Every session is retained until deleted, viewable as a full transcript, and filable to the site safety officer as an incident log. This is the institutional value loop: the site accumulates an auditable incident record it did not have before. It does **not** change what SANA says — data still flows outward only (Section 2, rule 6).

### 5B. INVARIANTS THE DESIGN HONOURS — DO NOT LET EDITS WEAKEN THEM

- SANA never diagnoses, prescribes, or triages — stated on every screen.
- Notes and the handover sheet are a **record of what was said**, not an assessment. The handover sheet names what it deliberately does *not* contain.
- Steps come from published, vetted first-aid guidance — never the model's own words.
- Escalation (call emergency services / alert the safety officer) is **human-tapped**, never automatic.
- The terracotta/urgent colour is reserved for the emergency-dial action only. Nothing else spends it.
- Data flows outward only (filed to the safety officer; audio stays on device) and never back into guidance.

---

## 6. VISUAL & INTERACTION DESIGN

**Brand & tone.** Calm, trustworthy, clinical-but-human. Not alarming, not sterile. It should feel like a steady professional, not a flashing alarm.

**Palette (SANA brand).**
- Primary teal: deep, calm (e.g. `#0E7C74`), darker teal for depth (`#063B38`)
- Accent coral: `#EF6A4C` — reserved for the human-action / urgent controls (CALL FOR HELP, confirm)
- Neutrals: off-white backgrounds, deep teal-ink text (`#13322F`), muted grey (`#5B6B69`)
- Coral is the "a human must act here" colour. Don't spend it on decoration.

**Typography.** One warm, legible family. Oversized, high-contrast text on the Active Emergency screen — a scared person reads at arm's length. Short lines. No dense paragraphs anywhere in the live flow.

**Layout & accessibility (critical — this is an emergency tool).**
- Huge tap targets. One-handed, one-tap reach for the primary action and CALL FOR HELP.
- Extreme legibility: large type, high contrast, minimal chrome during an emergency.
- The Active Emergency screen shows at most: current state, current step, captions, CALL FOR HELP. Nothing else competing.
- Motion is calm and slow. No jarring flashes. A gentle "listening" indicator, not a strobe.
- Works with audio as the primary channel; screen is the backup/confirmation.

**States the UI must express clearly:** Listening · Thinking/Matching · Confirming (needs human) · Guiding (step N) · Escalating · Recording (always, subtly) · Resolved.

---

## 7. WHAT LIVES WHERE (so the build's mental model is right)

- **On your servers (Vultr):** frontend hosting, backend/API, session state, the frozen protocol library (scripts + pre-recorded audio + retrieval index), the incident log store (Postgres), and the **site-profile store** (per-site building, kit location, safety officer, nearest hospital, local emergency number). EU/in-region hosting for regulated markets **[LATER]**.
- **On the device:** the session audio. It stays there. What leaves the device is the **filed incident log** — text, timestamped, no diagnosis — and only when a human files it.
- **External API calls:** Speech-to-text (e.g. Whisper), LLM orchestration/NLU (GPT-5.6 Luna Pro — language & orchestration ONLY, never medical authorship), text-to-speech. **Demo note:** protocol audio is **pre-generated once with Chatterbox (MIT)** and simply played back — no live TTS call in the critical path for the demo.
- **The LLM is not a step on the spine.** It is the intelligence inside understanding, matching, and pacing. Medical content comes only from the library.

---

## 8. DEMO SCOPE (FOR 28 AUGUST) — DON'T OVERBUILD

- **Languages:** English only for the demo. Architecture must treat language as a content layer (each protocol translated + voice-recorded once) so adding Arabic/Swahili is a content step, not a rebuild.
- **Protocols:** 3 end-to-end — **snakebite, fainting/unconsciousness, choking.** Scripts authored in SANA's own plain words from open evidence (WHO / IFRC / ILCOR facts) and clinician-reviewed. Audio pre-generated with Chatterbox.
- **Site profile:** one seeded demo site, with **999** as its emergency number (Qatar).
- **Escalation:** one-tap dial + show the incident summary. Automated dispatch integration is **[LATER]**.
- **The demo must show, live:** speak → match → **confirm** → guided steps aloud → CALL FOR HELP → incident record generated. That single loop, done safely, is the whole demo.

---

## 9. THE COMPRESSED MASTER PROMPT (paste-ready for a builder / design tool)

> Build the frontend for **SANA**, a calm, voice-first emergency first-aid companion for the minutes before professional help arrives. A frightened bystander speaks; SANA identifies the correct **vetted, clinically-reviewed first-aid protocol**, **confirms the match with the human**, then reads **pre-approved, locked steps aloud** one at a time until help arrives, and generates a **timestamped incident record** for the responder.
>
> **Absolute rules SANA must enforce:** it NEVER diagnoses or names a cause (responds only to observable facts); it ALWAYS confirms the suspected protocol with the human before guiding; it reads medical steps **faithfully from locked scripts** and never paraphrases or invents them; **escalation is human-initiated** via an always-visible CALL FOR HELP control that dials the **site profile's local emergency number** (SANA never auto-escalates); if it cannot confidently match, it does not guess — it tells the human to call for help. Everything is logged; incident data flows outward to responders/audit/anonymized insight and NEVER back into the guidance. Privacy by design: minimal data, explicit consent for health data, store the incident not the identity, audio stays on the device.
>
> **SANA is deployed per site** and knows that site from a **site profile**: building and zones, first-aid kit location, safety officer on duty, nearest hospital, local emergency number.
>
> **Screens:** (1) Consent gate — five explicit acknowledgements, a hard gate before first use; (2) Ready/standby — one "Hold to talk" target plus what the site profile knows; (3) Live conversation — voice orb, last thing SANA said, confirm-before-guiding beat (Continue / Not right?), current step, persistent CALL FOR HELP and alert-safety-officer, "noted so far" facts, plus a text-first variant for noisy or quiet rooms; (4) Handover sheet — what happened / observed / actions taken / **not included** / timeline, readable to a paramedic and filable to the safety officer; (5) Sessions — history and full transcripts, delete removes audio and filed log.
>
> **Design:** calm, trustworthy, human — never alarming or sterile. Teal primary (`#0E7C74` / deep `#063B38`), coral (`#EF6A4C`) reserved strictly for the emergency-dial action, off-white backgrounds, deep-teal ink text. Oversized high-contrast type, huge one-handed tap targets, minimal chrome during an emergency, slow calm motion (no flashing). Audio is the primary channel; the screen confirms and supports it.
>
> **Demo scope:** English only; three protocols (snakebite, fainting, choking) with pre-recorded audio; one seeded site with 999 as its emergency number; one-tap escalation. Language is a content layer so more languages are added later without a rebuild. Show the full loop live: speak → match → confirm → guided steps → CALL FOR HELP → incident record.
>
> Do not add features that dilute the core loop. Do not let any visual choice override the safety rules above.

---

## 10. OPEN ITEMS TO RESOLVE (NOT BLOCKERS FOR THE DEMO)

- Clinician sign-off on the 3 demo scripts (required before saying "reviewed").
- Guardian-consent flow for the schools scenario.
- In-region hosting decision for regulated markets.
- Live TTS layer for dynamic confirm lines (demo can pre-record these).
- Kenya Red Cross partnership conversation (content authority + commercial-use path).
- Site dressing for the Qatar pitch: the demo site is still the Greenfield High school framing. The stronger Gulf story is a worksite / heat-collapse framing (Msheireb Site B, Zone B level 2). Deferred, not dropped — see `docs/SANA_Design_ChangeList_Qatar.md` §A5.
- Confirm the chosen demo hospital's real ER hours; the design now asserts 24 hrs.
