import {
  CONFIDENCE_THRESHOLD,
  matchProtocol,
  PROTOCOLS,
  RESPONSE_INTENTS,
  type Match,
  type Protocol,
  type ResponseIntent,
} from './library.js';
import { configured, llm, TIMEOUT_MS, type ProviderConfig } from './providers.js';

/**
 * The boundary the model speaks across — master prompt section 1.2.
 *
 * This file is the safety artefact, and the narrow shape of what may cross is
 * the whole of it. **Exactly two values come back from the model: a protocol
 * id, and a number.** Nothing else is read, and nothing else can be, because
 * `crossBoundary` builds its result field by field rather than passing an
 * object through. A model that returns beautifully worded first-aid steps has
 * them dropped on the floor here, unread.
 *
 * That is stricter than section 1.2 requires — it also permits observed facts
 * and conversational glue to come back. Both are deliberately not taken:
 *
 *   - **Observed facts** are re-derived on-device instead, by intersecting the
 *     transcript with the library's own cue lists. The facts shown on the
 *     confirm screen are what the *library* recognises, so nothing a model
 *     wrote is ever displayed next to a medical decision the human is about
 *     to make.
 *   - **Conversational glue** already exists as locked, hashed system lines in
 *     `_system.json`. Letting a model write those sentences instead would put
 *     model prose in the one place — the pause before guidance — where a
 *     frightened person is least able to tell the difference.
 *
 * Neither exclusion costs anything the demo needs, and both can be relaxed
 * later by widening this function alone.
 *
 * When there is no provider, no key, no network, or a bad answer, the
 * on-device matcher runs instead. Falling back is not a degraded mode: the
 * worst case is that SANA fails to match and says so, which is the behaviour
 * the safety rails demand anyway.
 */

const KNOWN: ReadonlyMap<string, Protocol> = new Map(
  PROTOCOLS.map((protocol) => [protocol.id, protocol]),
);

export interface Selection {
  readonly protocol: Protocol;
  readonly confidence: number;
}

/**
 * The only door. Takes whatever the model returned and yields at most an id
 * and a confidence, or nothing.
 *
 * Everything is validated rather than trusted: an id that is not in the frozen
 * library cannot select anything, and a confidence that is not a real number
 * in [0, 1] is not a confidence. `raw` is typed `unknown` on purpose — this
 * function is the point where untyped model output becomes typed data, and
 * asserting a shape here would defeat it.
 */
export const crossBoundary = (raw: unknown): Selection | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const fields = raw as Record<string, unknown>;

  const id = fields['protocol_id'];
  if (typeof id !== 'string') return null;
  const protocol = KNOWN.get(id);
  // An id the frozen library does not contain selects nothing. This is what
  // makes a hallucinated protocol harmless rather than dangerous.
  if (!protocol) return null;

  const confidence = fields['confidence'];
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;
  if (confidence < 0 || confidence > 1) return null;

  // Built field by field. Nothing else in `fields` is reachable from here.
  return { protocol, confidence };
};

/**
 * What the model is asked for.
 *
 * It is given ids and cue lists — never step wording, so no medical text is
 * in the context to echo back — and told to answer with two fields.
 */
const instructions = (): string =>
  [
    'You route emergency descriptions to a first-aid protocol. You do not give first aid.',
    '',
    'Rules:',
    '- Choose at most one protocol id from the list below, based only on what the speaker described.',
    '- Never write, quote, paraphrase or reorder first-aid instructions.',
    '- Never name a cause, a diagnosis or a condition beyond choosing an id.',
    '- Never decide to call emergency services; a human does that.',
    '- If you are not confident, return a low confidence. Do not guess a protocol to be helpful.',
    '',
    'Protocols:',
    ...PROTOCOLS.map(
      (protocol) => `- ${protocol.id}: recognised by — ${protocol.match_cues.join('; ')}`,
    ),
    '',
    'Reply with JSON only: {"protocol_id": "<id or empty string>", "confidence": <0 to 1>}',
  ].join('\n');

/**
 * Re-derive the observable cues on-device.
 *
 * The confirm screen shows these, so they are taken from the library and the
 * transcript rather than from the model. The human is about to make a medical
 * decision from what is on that screen; every word of it should be traceable
 * to reviewed content or to their own speech.
 */
const cuesFor = (protocol: Protocol, transcript: string): readonly string[] => {
  const said = transcript.toLowerCase();
  return protocol.match_cues.filter((cue) =>
    cue
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .some((word) => said.includes(word)),
  );
};

interface ChatResponse {
  choices?: { message?: { content?: unknown } }[];
}

const ask = async (
  provider: ProviderConfig,
  transcript: string,
  signal: AbortSignal,
): Promise<unknown> => {
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: instructions() },
        { role: 'user', content: transcript },
      ],
    }),
    signal,
  });
  if (!response.ok) throw new Error(`selector responded ${response.status}`);

  const body = (await response.json()) as ChatResponse;
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('selector returned no content');
  return JSON.parse(content) as unknown;
};

export interface SelectionResult {
  readonly match: Match | null;
  /** Why the on-device matcher ran, when it did. Recorded, not hidden. */
  readonly fallbackReason: string;
}

/**
 * Select a protocol for what was described.
 *
 * Tries the model, then the on-device matcher. Either way the result is a
 * `Match` carrying the protocol from the frozen library — the id chooses which
 * locked content is pulled, and the content itself never travels.
 */
export const selectProtocol = async (transcript: string): Promise<SelectionResult> => {
  const onDevice = (reason: string): SelectionResult => ({
    match: matchProtocol(transcript),
    fallbackReason: reason,
  });

  const provider = llm();
  if (!configured(provider)) return onDevice('no selector configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const selection = crossBoundary(await ask(provider, transcript, controller.signal));
    // A refusal to answer is a legitimate answer. Falling through to the
    // on-device matcher is what stops "the model said nothing" from becoming
    // "SANA said nothing".
    if (!selection) return onDevice('selector returned nothing usable');
    if (selection.confidence < CONFIDENCE_THRESHOLD) {
      return { match: null, fallbackReason: '' };
    }
    return {
      match: {
        protocol: selection.protocol,
        confidence: selection.confidence,
        matched: cuesFor(selection.protocol, transcript),
        selector: 'llm',
      },
      fallbackReason: '',
    };
  } catch (error) {
    return onDevice(error instanceof Error ? error.message : 'selector unreachable');
  } finally {
    clearTimeout(timer);
  }
};


/* ── The second boundary: intents ─────────────────────────────────────────
 *
 * Conversation is routed exactly the way protocol selection is routed, and for
 * the same reason. The model is given the person's words and a list of intent
 * ids; it returns one id. It is never shown the reply wording, so there is
 * nothing in its context to echo, paraphrase or improve on, and no field it
 * could set that would put a sentence it wrote in front of a frightened
 * person.
 *
 * The temptation this design exists to refuse: once SANA is listening, it will
 * feel obvious to let the model write one custom reassurance for the reply
 * that fits no intent. It must not. Unmatched input gets the locked `unclear`
 * line and the guidance holds where it is. If the intent set turns out to be
 * too small, the fix is a new locked, reviewed line — never an open mouth.
 */

const INTENTS: ReadonlySet<string> = new Set(RESPONSE_INTENTS);

/**
 * The only door for a spoken reply. One known intent id, or nothing.
 *
 * A near-copy of `crossBoundary` on purpose. The duplication is worth more
 * than a shared generic would be: each boundary is short enough to read in
 * full and verify by eye, which is the property that matters for the two
 * functions in this codebase that decide what a model is allowed to do.
 */
export const crossIntentBoundary = (raw: unknown): ResponseIntent | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const fields = raw as Record<string, unknown>;

  const id = fields['intent_id'];
  if (typeof id !== 'string') return null;
  // Not in the fixed set, not an intent. A hallucinated intent selects nothing
  // and falls through to the locked `unclear` line.
  if (!INTENTS.has(id)) return null;

  // Returned as a bare string. There is no object here for anything else to
  // travel inside.
  return id as ResponseIntent;
};

const intentInstructions = (): string =>
  [
    'You classify what a person said while being guided through first aid.',
    'You do not give first aid, and you do not reply to them.',
    '',
    'Rules:',
    '- Return exactly one intent id from the list below.',
    '- Never write a reply, a reassurance, or any first-aid wording.',
    '- Never name a cause, a diagnosis or a condition.',
    '- Never decide to call emergency services; a human does that.',
    '- If the meaning is not clear, return "unclear". Do not guess to be helpful.',
    '',
    'Intents:',
    '- ready: they are ready to continue to the next step',
    '- repeat: they did not hear or did not follow, and want it again',
    '- panic: they express fear or distress',
    '- changed: they report something new happening',
    '- stop: they want to stop, or a responder has taken over',
    '- unclear: anything else',
    '',
    'Reply with JSON only: {"intent_id": "<one of the ids above>"}',
  ].join('\n');

export interface IntentResult {
  readonly intent: ResponseIntent;
  readonly selector: 'llm' | 'unclassified';
}

/**
 * Classify a spoken reply.
 *
 * Every failure path — no provider, no key, no network, a timeout, a malformed
 * answer, an unknown id — lands on `unclear`, which is a locked line that
 * holds the guidance where it is. That is deliberately not the same shape as
 * protocol selection, which falls back to an on-device matcher: here, holding
 * still and saying so is always safe, and the person's taps still work.
 */
export const classifyIntent = async (transcript: string): Promise<IntentResult> => {
  const provider = llm();
  if (!configured(provider)) return { intent: 'unclear', selector: 'unclassified' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: intentInstructions() },
          { role: 'user', content: transcript },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { intent: 'unclear', selector: 'unclassified' };

    const body = (await response.json()) as ChatResponse;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { intent: 'unclear', selector: 'unclassified' };

    const intent = crossIntentBoundary(JSON.parse(content) as unknown);
    return intent ? { intent, selector: 'llm' } : { intent: 'unclear', selector: 'unclassified' };
  } catch {
    return { intent: 'unclear', selector: 'unclassified' };
  } finally {
    clearTimeout(timer);
  }
};
