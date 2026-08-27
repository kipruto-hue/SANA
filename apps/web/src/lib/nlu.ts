import {
  CONFIDENCE_THRESHOLD,
  matchProtocol,
  PROTOCOLS,
  type Match,
  type Protocol,
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
