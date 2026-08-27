# SANA — SYSTEM MASTER PROMPT (Architectural Law + Today's Build Plan)

> Received 2026-08-27 (session 05), verbatim. This document is architectural law.
> Where it disagrees with code, or with `docs/SANA_Master_Prompt.md`, **this
> document wins**. Filed unedited; commentary belongs in `docs/decisions/`.

### Corrective awareness spec. The build exists partway; this defines where every piece MUST sit AND the sequenced work for today. When code and this document disagree, this document wins.

---

## 0. PURPOSE
This is the operating law of the system plus today's ordered build. SANA guides people through medical emergencies in the minutes before help arrives. Because lives depend on it, the architecture's safety is non-negotiable. Any decision — including any item in today's plan — that violates a rule in Section 2 is wrong, however convenient.

The single principle behind everything:
> **The LLM understands and converses. It never authors the medicine, and it never authors the record.**
> Medicine comes from the vetted library. The record comes from the system. The LLM only routes, talks, and (optionally) rephrases already-locked facts.

---

## 1. THE PIPELINE (fixed order, fixed roles)

**1. STT — the ears.** (Whisper API, OpenAI.)
- Hears the speaker, detects the language, transcribes speech to text.
- Language detection happens HERE, from the audio — not set by a person, not guessed by the LLM.
- Output: plain text + detected language. It does NOT interpret, diagnose, or decide.

**2. LLM — the brain and the conversation.** (GPT-5.6 Luna Pro.)
- Reads the STT text, understands the situation, SELECTS the correct protocol from the library, and runs the conversation (asking, confirming, pacing).
- Works entirely in TEXT. Never hears audio, never produces audio.
- Outputs a PROTOCOL SELECTION (an identifier/key) + conversational glue lines. It does NOT output medical step wording.
- HARD LIMITS: never generate/paraphrase/reorder/invent medical instructions; never diagnose or name a cause (observable facts only); never decide to escalate; if it cannot confidently match, do NOT guess — direct the human to call emergency services.

**3. THE VETTED LIBRARY — source of the medicine.**
- Pre-approved, clinically reviewed, locked, version-controlled medical wording per protocol.
- When the LLM selects a protocol, the SYSTEM pulls THAT protocol's locked content. Wording NEVER comes from the LLM's weights.
- Frozen: changes only through deliberate human-reviewed updates — never at runtime, never from user input.

**4. TTS — the mouth.** (Chatterbox first / Fish Audio if higher quality wanted.)
- Speaks the guidance.
- LOCKED protocol steps: PRE-RECORDED audio files, generated ahead of time from library text, played LOCALLY, working OFFLINE. No live generation on the critical path.
- CONVERSATIONAL GLUE only (acknowledgements, confirm questions, transitions): live TTS permitted — it carries no medical instruction.

**5. THE EVENT LOG — the system's memory (source of truth).**
- The SYSTEM (deterministic code) records every event the instant it happens: timestamp + what occurred. APPEND-ONLY and exact.
- The LLM does NOT create, populate, or reconstruct this log.
- The handover record is DERIVED from this log — a view of recorded facts, not a retelling.

**6. LLM SUMMARY (optional, last step) — rephrasing, not authoring.**
- May take the exact recorded log and reword it into readable language. May ONLY reword facts already logged. NEVER adds, infers, interprets, or invents.
- Log stays the source of truth; summary never contradicts or exceeds it.

---

## 2. RULES THAT MUST NEVER BREAK (check every build decision, including today's)
- [ ] Medical wording comes ONLY from the vetted library, NEVER the LLM.
- [ ] The LLM selects a protocol; never writes/edits/paraphrases medical steps.
- [ ] The LLM never diagnoses, never names a cause — observable facts only.
- [ ] The human confirms the protocol before guidance is read.
- [ ] Escalation is human-initiated; the system never auto-escalates.
- [ ] The event log is written by deterministic system code, NEVER by the LLM.
- [ ] The handover record is DERIVED from the exact log, not reconstructed by the LLM.
- [ ] Any LLM summary rephrases logged facts only — adds nothing.
- [ ] Locked protocol audio is pre-recorded, plays locally/offline; no live medical TTS on the critical path.
- [ ] If confident protocol match fails, the system does not guess — it directs to emergency services.

If a proposed change (or a task below) would break any box, it is rejected. No exceptions for speed or elegance.

---

## 3. TODAY'S BUILD PLAN (sequenced, and checked against the architecture above)

Order is deliberate: build what a reviewer SEES and what carries risk first; leave cosmetic and cuttable work last.

**THIS MORNING — Append-only event log + handover record derived from it.**
- Why first: it is the one gap a reviewer sees — Handover is the last screen of the run and currently has nothing real behind it.
- Architecture check: this IS Section 1.5 and 1.6. Build the deterministic append-only log NOW (system-written, timestamped, exact). Derive the handover as a VIEW of that log. Do NOT let the LLM populate it. (Rules: log written by system ✓, handover derived not reconstructed ✓.)
- Done when: every event in a run lands in the append-only log with a timestamp, and the handover screen renders straight from that log with zero invented content.

**MIDDAY — Uninterrupted run-through on the ACTUAL demo machine.**
- Why now: nothing has ever run in front of a reviewer end-to-end; this is where surprises live.
- Scope: mic permissions, offline behaviour, all three protocols, front to back.
- Architecture check: this is where the two LIVE API calls are exercised — STT (Whisper) and the LLM (GPT-5.6) — plus playback of the pre-recorded protocol audio. Confirm the locked steps play from LOCAL files (offline), and confirm the human CONFIRMS the protocol before steps read, and that ESCALATION is human-tapped. (Rules: human confirm ✓, human escalation ✓, offline local audio ✓.)
- Done when: all three protocols run start-to-finish on the demo machine, mic works, offline path holds, and the log + handover populate correctly from the real run.

**AFTERNOON — Real pre-recorded audio replacing browser speech synthesis.**
- Why here: cosmetic-but-visible; browser synthesis is a survivable fallback if hours run out.
- Do: generate the locked protocol-step audio ONCE. Chatterbox first (free, MIT); switch to Fish Audio only if you want noticeably better voice cheaply. Store the files locally; wire playback to them.
- Architecture check: this is Section 1.4. These are the LOCKED-STEP files — pre-recorded, local, offline. Live TTS stays reserved for conversational glue only. (Rule: pre-recorded local medical audio ✓.)
- Done when: locked steps play from real pre-recorded files; browser synthesis remains only as an emergency fallback.

**CUT (do NOT build today) — Server/API backend and its frozen-library hash boot gate.**
- Why cut: nothing on the demo path needs a backend, and escalation has no server-side implementation by design — better declared cut than half-built.
- Architecture check: the frozen-library integrity check (hash gate) is real and belongs to the PRODUCTION system, not the demo. Declaring it cut is honest; a half-built backend on the demo path is a liability. (No rule requires it for the demo.)
- Say in the pitch, if asked: "The demo runs client-side by design; the backend and library-integrity gate are the next build, not faked for the demo."

---

## 4. FLOW CHECK (today's plan against the pipeline — everything lines up)
- Morning builds pipeline stages 5 + 6 (log + handover). ✓
- Midday exercises stages 1 + 2 live (STT + LLM) and stage 4 playback, and proves the human-confirm + human-escalate rules. ✓
- Afternoon completes stage 4 (locked-step pre-recorded audio). ✓
- Cut correctly excludes production-only pieces (backend, hash gate) that no rule needs for the demo. ✓
- Nothing in today's plan asks the LLM to author medicine or the record. ✓

---

## 5. ONE-PARAGRAPH VERSION (paste at the top of any build brief)
> SANA is a voice-first emergency guide. STT (Whisper) hears, detects language, transcribes. The LLM (GPT-5.6) reads that text, understands, SELECTS the correct protocol, and runs the conversation — but NEVER writes medical content, NEVER diagnoses, NEVER decides to escalate. Medical words come only from a vetted, locked library; the human confirms the protocol before steps are read. TTS speaks the guidance, playing pre-recorded LOCAL files for the locked medical steps (offline-capable) and generating live only for conversational glue. The system records every event deterministically as it happens — this log is the source of truth, and the handover is derived from it, never reconstructed by the LLM. The LLM may, as a final optional step, rephrase the exact logged facts into readable language, adding nothing. Today: build the append-only log + derived handover first; then run all three protocols end-to-end on the demo machine (mic, offline, STT+LLM live); then swap in pre-recorded audio (Chatterbox free, or Fish Audio); leave the backend and frozen-library hash gate cut, by design. The LLM understands and converses; it never authors the medicine and never authors the record.
