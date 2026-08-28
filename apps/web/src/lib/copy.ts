/**
 * Everything the interface says.
 *
 * Kept in one place, and kept strictly apart from `library.ts`. The division
 * is a safety boundary, not tidiness:
 *
 *   - `library.ts` is what SANA **says** — spoken, reviewed, hashed, frozen.
 *     Nothing in this file is ever read aloud.
 *   - this file is what the **interface** says — labels, headings, empty
 *     states, errors. Product writing, editable without a clinician.
 *
 * If a sentence here ever needs to be spoken, it belongs in the library
 * instead, and it needs review before it gets there.
 *
 * ── The voice ──────────────────────────────────────────────────────────────
 *
 * SANA sounds like a steady colleague who has done this before. Master prompt
 * section 2: calm is the product, not decoration.
 *
 *   Short sentences. A frightened person reads four words at a time.
 *   Plain words. "Tell me what you can see", never "describe the presentation".
 *   Second person, present tense. It is happening now.
 *   Never alarming, never cute. No exclamation marks. No emoji. No jokes.
 *   Honest about limits — the limits are the product's spine, not fine print.
 *   Say what a control does, then say it happened.
 */

export const BRAND = {
  name: 'SANA',
  /**
   * The line under the name. Possessive on purpose: in an emergency SANA is
   * not a service being consulted, it is the thing in your hand that is on
   * your side. "Until help arrives" names the exact window the product owns —
   * it does not claim to replace the help that is coming.
   */
  tagline: 'Your steady voice until help arrives.',
  /** One sentence, for when there is room for one sentence. */
  mission:
    'Tell me what you can see. I’ll find the right first-aid steps, check them with you, and read them out one at a time.',
  /** What SANA is not. Said early, and never buried. */
  limits:
    'SANA does not diagnose, prescribe or triage. In a life-threatening emergency, call your emergency services first.',
} as const;

export const WELCOME = {
  eyebrow: 'For the minutes before help arrives',
  nameLabel: 'Your name',
  namePlaceholder: 'So the handover sheet knows who was here',
  nameHint: 'Kept on this device and written onto the incident record.',
  submit: 'Continue',
} as const;

export const CONSENT = {
  eyebrow: (operator: string) => `Before we start, ${operator}`,
  title: 'Five things to agree on',
  intro:
    'These are the limits of what SANA is. They are separate so none of them can be skimmed past.',
  submitReady: 'I agree — continue',
  submitWaiting: (remaining: number) =>
    remaining === 1 ? 'One more to tick' : `Tick all five to continue`,
  back: 'Back',
} as const;

export const STANDBY = {
  eyebrow: 'Ready',
  restingLine: 'If something happens, hold the button and tell me what you can see.',
  primary: 'I need help',
  setupTitle: 'What should SANA know?',
  setupEyebrow: 'Site setup',
  setupIntro:
    'SANA is deployed per site. These are stored here and read when needed — nothing is built into the app, so the same version works anywhere.',
  setupSave: 'Save',
  setupCancel: 'Cancel',
  edit: 'Edit site details',
  setUp: 'Set up this site',
  notConfiguredTitle: 'This site isn’t set up yet.',
  notConfiguredBody: 'SANA doesn’t know where it is or what number to dial, and it won’t guess.',
  notConfiguredAction: 'Set it up',
  missing: 'not configured',
  reviewPending:
    'The three demo protocols are waiting on clinician sign-off. Until a named clinician has signed them, SANA doesn’t call them reviewed.',
} as const;

export const LIVE = {
  recording: 'Recording this incident',
  tapToTalk: 'Tap to talk',
  listening: 'Listening…',
  goAhead: 'Go ahead…',
  thinking: 'Thinking…',
  typeLabel: 'Or type what you can see',
  typePlaceholder: 'She collapsed and won’t wake up',
  typeSubmit: 'Tell SANA',
  confirmKicker: 'Check with me first',
  confirmYes: 'Yes, that’s it',
  confirmNo: 'Not right',
  unmatchedKicker: 'I can’t match this',
  unmatchedRetry: 'Describe it again',
  stepOf: (n: number, total: number, title: string) => `Step ${n} of ${total} · ${title}`,
  back: 'Back',
  next: 'Next step',
  lastStep: 'Done',
  repeat: 'Read that again',
  completeKicker: 'That’s everything I have',
  openHandover: 'Open the handover sheet',
  call: (number: string) => `Call for help · ${number}`,
  callUnavailable: 'No emergency number set for this site',
  calledAt: (time: string) => `Called at ${time}. The handover sheet is ready to read out.`,
  endSession: 'End session and open handover',
  micRefused: 'Microphone permission was refused. You can type what you can see instead.',
  micStopped: (reason: string) => `Speech recognition stopped (${reason}). You can type instead.`,
  micUnsupported: 'This browser can’t listen. Type what you can see instead.',
  /**
   * Shown while SANA listens for a reply between steps. Says what it is doing
   * and what still works, because a microphone that opens on its own has to
   * account for itself immediately.
   */
  awaitingReply: 'Listening — say “ready” when you want the next step, or use the buttons.',
} as const;

export const HANDOVER = {
  eyebrow: 'Handover sheet',
  title: 'Read this to the responder',
  called: 'Help called',
  whereWho: 'Where and who',
  whatHappened: 'What happened',
  nothingDescribed: 'Nothing was described in this session.',
  observed: 'Observed — as reported by the operator',
  actions: 'Actions taken',
  noActions: 'No guidance was given during this session.',
  notIncluded: 'Not included',
  timeline: 'Timeline',
  conversation: 'What was said during guidance',
  conversationNote:
    'The operator’s own words, with how SANA understood each one. SANA classified these into a fixed set of six replies; it did not interpret them medically.',
  copy: 'Copy for the record',
  copied: 'Copied',
  save: 'Save a copy',
  /**
   * Said plainly because it is the honest shape of the demo: there is no
   * server, so the record leaves this device only when the operator saves it.
   */
  saveHint: 'The record is kept on this device. Saving writes it out as a file you can hand on.',
  chosenBy: (selector: string) =>
    selector === 'llm'
      ? 'Protocol chosen by the language model, confirmed by the operator.'
      : 'Protocol chosen on this device, confirmed by the operator.',
  backToSession: 'Back to session',
  finish: 'Finish',
  provenance: (title: string) =>
    `Steps read from “${title}”, sourced from published first-aid guidance and waiting on clinician sign-off. SANA did not write them.`,
} as const;

/**
 * What the handover sheet deliberately does not contain.
 *
 * On the sheet itself rather than in a footnote. A paramedic reading it needs
 * to know instantly that this is a record of what was said, not an assessment
 * of a patient — otherwise the document invites exactly the trust it has not
 * earned.
 */
export const NOT_INCLUDED = [
  'No diagnosis. SANA never names a cause.',
  'No assessment of severity or priority.',
  'No vital signs beyond what the operator said aloud.',
  'No medication given or advised.',
] as const;

/**
 * The five consent acknowledgements.
 *
 * Separate rather than one blanket "I agree to the terms". The first two are
 * the limits of what SANA is; folding them into a single checkbox would defeat
 * the reason for stating them.
 */
export const ACKNOWLEDGEMENTS = [
  'SANA cannot diagnose, prescribe or triage. It reads first-aid steps that people have written and reviewed.',
  'If this is life-threatening, I will call emergency services first. SANA is for the wait, not instead of the call.',
  'I am an adult, or staff on duty at this site.',
  'SANA may use my microphone to hear what I describe.',
  'This session is recorded and a written transcript kept, so an incident record can be handed to a responder.',
] as const;

export const SITE_FIELDS = [
  ['site', 'Site name'],
  ['zone', 'Area or zone'],
  ['emergencyNumber', 'Local emergency number'],
  ['hospital', 'Nearest hospital'],
  ['safetyOfficer', 'Safety officer on duty'],
  ['kitLocation', 'Where the first-aid kit is'],
] as const;

export const SITE_SUMMARY = [
  ['emergencyNumber', 'Emergency number'],
  ['safetyOfficer', 'Safety officer on duty'],
  ['kitLocation', 'First-aid kit'],
  ['hospital', 'Nearest hospital'],
] as const;
