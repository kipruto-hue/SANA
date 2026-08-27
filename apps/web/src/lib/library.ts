import choking from '../../../../packages/protocols/content/choking-adult.json';
import fainting from '../../../../packages/protocols/content/fainting-unresponsive.json';
import snakebite from '../../../../packages/protocols/content/snakebite.json';
import systemLines from '../../../../packages/protocols/content/_system.json';

/**
 * The frozen library, read straight from the same JSON the API hashes.
 *
 * Imported rather than copied so there is exactly one source of medical
 * wording in the repository. If these files change, the manifest check fails
 * and CI catches it — the app cannot quietly drift from the reviewed content.
 */

export interface Step {
  readonly n: number;
  readonly text: string;
  readonly audio: string;
}

export interface Protocol {
  readonly id: string;
  readonly title: string;
  readonly spoken_title: string;
  readonly confirm_prompt: string;
  readonly match_cues: readonly string[];
  readonly escalate_immediately: boolean;
  readonly steps: readonly Step[];
  readonly sources: readonly string[];
  readonly clinician_review: { readonly status: 'pending' | 'approved' };
}

export const PROTOCOLS: readonly Protocol[] = [choking, fainting, snakebite] as Protocol[];

export const LINES = systemLines.lines as Record<string, { text: string; audio: string }>;

export const line = (name: keyof typeof LINES | string): string =>
  LINES[name]?.text ?? '';

/** True when a named clinician has signed off every script. */
export const FULLY_REVIEWED = PROTOCOLS.every((p) => p.clinician_review.status === 'approved');

/** Which component chose the protocol. Recorded, so the record can say. */
export type Selector = 'on-device' | 'llm';

export interface Match {
  readonly protocol: Protocol;
  readonly confidence: number;
  readonly matched: readonly string[];
  /**
   * Whichever selector produced this. The handover has to be able to state
   * whether a model was in the loop for the match, and an unlabelled match
   * makes that unanswerable after the fact.
   */
  readonly selector: Selector;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on',
  'at', 'it', 'he', 'she', 'they', 'them', 'his', 'her', 'their', 'has', 'have',
  'not', 'no', 'i', 'we', 'you', 'me', 'my', 'someone', 'person', 'help',
]);

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

/**
 * Match what the human described against the library's observable cues.
 *
 * Deliberately retrieval, not generation. The demo matches locally against the
 * cue lists rather than asking a model, which means no medical reasoning
 * happens anywhere in this path — the worst case is that it fails to match and
 * SANA says so, which is the behaviour the safety rails require anyway.
 *
 * The NLU provider replaces the scoring here later. It will still only ever
 * return a protocol id from this same set, never wording.
 */
export const matchProtocol = (transcript: string): Match | null => {
  const said = new Set(words(transcript));
  if (said.size === 0) return null;

  let best: Match | null = null;

  for (const protocol of PROTOCOLS) {
    const matched: string[] = [];
    let score = 0;

    for (const cue of protocol.match_cues) {
      const cueWords = words(cue);
      if (cueWords.length === 0) continue;
      // A cue counts when most of its distinctive words were actually said.
      const hits = cueWords.filter((w) => said.has(w)).length;
      const ratio = hits / cueWords.length;
      if (ratio >= 0.5) {
        matched.push(cue);
        score += ratio;
      }
    }

    if (matched.length === 0) continue;
    const confidence = Math.min(0.95, score / 2.5);
    if (!best || confidence > best.confidence) {
      best = { protocol, confidence, matched, selector: 'on-device' };
    }
  }

  return best;
};

/** Below this, SANA does not guess — it tells the human to call for help. */
export const CONFIDENCE_THRESHOLD = 0.3;
