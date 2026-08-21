# SANA DESIGN — QATAR DRESSING: CHANGE LIST + UPDATED DOCUMENTATION

This file has two parts:
- **Part A** — the exact wording/flow changes to apply in Claude Design, screen by screen, so every render (phone + laptop, 2a + 2b, and the Turn-1 directions) stays consistent.
- **Part B** — the documentation update, so the master prompt now matches the *real* five-screen design (including the site-profile and sessions screens the render added).

Apply Part A in Claude Design itself (the file lives and renders there). Work by **find-and-replace on the strings below** — each is listed with how many times it appears so you know when you've caught them all.

---

## PART A — EXACT CHANGES

### A1. Emergency number: 112 → 999 (Qatar)  ⚑ highest priority
The number `112` appears **19 times** across the renders. Every one becomes **999**. Do a global find for `112` and replace with `999`. Specific strings to confirm you've caught:

| Find (exact) | Replace with |
|---|---|
| `Call 112` (×7) | `Call 999` |
| `Emergency services · 112` | `Emergency services · 999` |
| `Not a doctor. Not triage. In a life-threatening emergency, call 112.` | `Not a doctor. Not triage. In a life-threatening emergency, call 999.` |
| `I've put 112 and Amina on your screen. Tell me what you can see from where you are.` | `I've put 999 and Amina on your screen. Tell me what you can see from where you are.` |
| `I've put 112 and Amina at the bottom of your screen. Tell me what you can see from where you are.` | `I've put 999 and Amina at the bottom of your screen. Tell me what you can see from where you are.` |
| `I've put 112 and Amina on the right. Tell me what you can see from where you are.` | `I've put 999 and Amina on the right. Tell me what you can see from where you are.` |
| `Placed on her side 21:07. 112 called 21:08. Warden Amina O. alerted 21:08.` | `Placed on her side 21:07. 999 called 21:08. Safety officer Amina O. alerted 21:08.` |
| `112 dialled from this device` (appears in timeline + system line) | `999 dialled from this device` |
| `112 called` (session-list tag) | `999 called` |

> NOTE: keep the *layout-specific phrasing* differences ("on your screen" on phone vs "on the right" on laptop) — only the number changes.

### A2. Hospital wording: A&E → ER / hospital
`A&E` (encoded `A&amp;E`) appears **2 times**. British → Gulf/international.

| Find | Replace with |
|---|---|
| `Nearest A&E` | `Nearest hospital` |
| `A&E open now · 08:00–00:00` | `ER open now · 24 hrs` (Qatar tertiary ERs are typically 24/7 — verify for your chosen hospital) |

### A3. "Warden" → "Safety officer"  (British-school term → neutral/Gulf)
`Warden`/`warden` appears **8 times** total. Unify to **Safety officer** (the design already uses "safety officer" once, so this makes it consistent).

| Find | Replace with |
|---|---|
| `Warden` (label) | `Safety officer` |
| `Warden on duty` | `Safety officer on duty` |
| `Warden Amina O.` | `Safety officer Amina O.` |
| `warden alerted` / `Warden alerted` | `safety officer alerted` / `Safety officer alerted` |
| `...and who the warden is.` | `...and who the safety officer is.` |
| `Next: microphone, then recording and your warden contact.` | `Next: microphone, then recording and your safety-officer contact.` |
| `Alert Amina` (button) | keep — it names the person, that's fine |

### A4. Phone number: Nigerian → Qatar
| Find | Replace with |
|---|---|
| `Amina O. · +234 803 ···` | `Amina O. · +974 3··· ····` |

(`+234` is Nigeria; `+974` is Qatar.)

### A5. Site setting (optional but recommended for the pitch)
The demo site is `Greenfield High, Block B`. Two options:

- **Keep it a school** but Gulf-dress the name — e.g. `Al Wakra Academy · Block B`. Schools are a real SANA market and the flow already fits.
- **Switch to a construction/worksite** — this is the *stronger* Qatar story (migrant workforce, heat, remote sites are the Gulf angle from the pitch). e.g. site `Msheireb Site B` / setting "Block B, ground floor" → "Zone B, level 2". If you do this, change the incident from "fainted" to a heat-collapse framing to match — higher relevance to Qatar reviewers.

Recommendation: for the 28th, the **worksite/heat** version lands harder with QDB. But it's more edits. If time is tight, the Gulf-named school is the safe minimum.

### A6. ⚑ Re-assert the CONFIRM-BEFORE-GUIDING safety beat (flow, not just wording)
The render jumps from *listening* straight into *"step 1 of 3: kneel beside her…"*. Our safety rule is that SANA states the suspected protocol and the **human confirms** before any steps are read. Add one short beat on screen 03 (Live conversation), both renders:

- After the user describes the situation and before the first guidance step, SANA says a confirm line, e.g.:
  *"This sounds like a faint. I'll talk you through the first steps — say 'go' or tap Continue."*
- Add a small **Continue / not right?** control at that moment.
- This keeps "the human owns the match" true, which is the line that makes SANA safe and defensible. Do NOT remove it for elegance.

> Keep it light for low-risk protocols; make it explicit for higher-risk ones. But it must exist.

### A7. Consistency sweep (do this last)
For each *logical screen*, confirm the change landed on **all** its renders:
- Screen 03 Live conversation: phone 2a, laptop 2a, phone 2b, laptop 2b, and Turn-1 directions 1a/1b/1c.
- Handover + Sessions: phone + laptop.
The Turn-1 direction screens (1a Quiet Line, 1b Record, 1c Steady) also contain "Call emergency services" / "Call 112" — update those too if you're keeping Turn 1 in the file, so nothing stale remains.

---

## PART B — DOCUMENTATION UPDATE (master prompt now matches the real design)

The five-screen flow in the design **is** SANA's flow. Update the master-prompt screen list (Section 5 of `SANA_Master_Prompt.md`) to these five, which the design proved out — folding in two screens the render added that my earlier spec didn't name:

1. **Consent gate** — five explicit acknowledgements before SANA will listen (cannot diagnose/prescribe/triage; call emergency services first in a life-threatening case; age/staff confirmation; mic; recording+transcript). Consent is a hard gate before first use. *(Matches Section 3 + 7 privacy rules — good.)*
2. **Ready / standby** — resting state. One primary "Hold to talk" target, plus what the **site profile** knows (first-aid kit location, safety officer, nearest hospital, emergency number). ← **site profile is a new, kept concept.**
3. **Live conversation** — voice orb carries it; last thing SANA said sits under it; **CALL 999**, alert safety officer, and "noted so far" facts stay one reach away. Includes the **confirm-before-guiding** beat (A6). A **text-first alternative (2b)** exists for noisy/quiet rooms — captions carry the screen.
4. **Handover sheet** — What happened / Observed / Actions taken / **Not included (no diagnosis, no severity)** / Timeline. Readable aloud to a paramedic, filable as an incident log to the site safety officer. Audio stays on device. *(This is the differentiator — keep it central.)*
5. **Sessions** — history list + full transcript of any picked session; each labelled (e.g. "Fainting, Block B corridor · Filed · 999 called"). Delete removes audio + filed log. ← **new, kept concept.**

**Two concepts the design added that the documentation should now own:**
- **Site profile** — SANA is deployed *per site* and knows the building, kit location, safety officer, nearest hospital, and local emergency number. This is also *why* the emergency number is dynamic (999 here) rather than hard-coded — it comes from the site profile. Bake this into the build.
- **Sessions/history + incident filing** — every session is retained (until deleted) and filable to the site safety officer. This is the institutional value loop: the site accumulates an auditable incident record.

**What stays exactly as documented (the design honours all of these — do not let edits weaken them):**
- SANA never diagnoses / prescribes / triages — stated on every screen.
- Notes/handover are a *record of what was said*, not an assessment.
- Steps come from *published/vetted first-aid guidance*, not the model's own words.
- Escalation (Call 999 / alert safety officer) is **human-tapped**, never automatic.
- Terracotta/urgent colour reserved for the emergency-dial action only.
- Data outward only (file to safety officer, audio stays on device); never back into guidance.

---

## PRIORITY ORDER (if time is short before the 28th)
1. **999 everywhere** (A1) — a "112" in a Qatar pitch is the one an alert reviewer catches instantly.
2. **Confirm-before-guiding beat** (A6) — the safety rail, and the thing a clinician looks for.
3. **A&E → hospital/ER, +974 number, warden → safety officer** (A2–A4).
4. **Gulf/worksite site dressing** (A5) — nice-to-have; strongest if you have time.
5. **Consistency sweep** (A7) — always last, so nothing stale survives.
