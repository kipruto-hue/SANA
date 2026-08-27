import { describe, expect, it } from 'vitest';

import { EMPTY_CONTEXT } from './context.js';
import { initialState, reducer, type Action, type State } from './flow.js';
import { CONFIDENCE_THRESHOLD, matchProtocol, PROTOCOLS } from './library.js';

const run = (actions: readonly Action[], from: State = initialState): State =>
  actions.reduce(reducer, from);

/**
 * A deliberately impossible number.
 *
 * Not a real emergency number even in tests: decision 0003 bans the literals,
 * and a fixture using a plausible one is how a plausible one ends up in the
 * app. What matters here is that whatever was configured is what the record
 * reports, so the value only has to be recognisable.
 */
const TEST_NUMBER = 'TEST-NUMBER-NOT-DIALLABLE';

/** A configured site, so the record has a number and a place to record. */
const SITE = {
  ...EMPTY_CONTEXT,
  site: 'Lusail Tower B',
  zone: 'Level 14',
  emergencyNumber: TEST_NUMBER,
};

const describedFainting = (): State => {
  const match = matchProtocol('she collapsed and will not wake up but she is still breathing');
  expect(match, 'the fixture phrase should match something').not.toBeNull();
  return run([
    { type: 'SIGN_IN', operator: 'Amina' },
    { type: 'CONSENT_GIVEN' },
    { type: 'START_EMERGENCY', context: SITE },
    { type: 'TRANSCRIPT', text: 'she collapsed and will not wake up but she is still breathing' },
    { type: 'MATCHING' },
    { type: 'MATCHED', match: match! },
  ]);
};

describe('the human owns the match', () => {
  it('will not reach guidance without a human confirmation', () => {
    const state = describedFainting();
    expect(state.phase).toBe('confirming');

    // Everything except HUMAN_CONFIRMED. None of these may open the door,
    // however confident the match was.
    const others: Action[] = [
      { type: 'NEXT_STEP' },
      { type: 'PREV_STEP' },
      { type: 'TRANSCRIPT', text: 'anything at all' },
      { type: 'HUMAN_TAPPED_CALL', number: TEST_NUMBER },
      { type: 'MATCHING' },
    ];
    for (const action of others) {
      expect(reducer(state, action).phase, `${action.type} must not start guidance`).not.toBe(
        'guiding',
      );
    }

    expect(reducer(state, { type: 'HUMAN_CONFIRMED' }).phase).toBe('guiding');
  });

  it('cannot be confirmed into guidance when nothing was suggested', () => {
    // A confirmation with no suggestion on the table is not a confirmation of
    // anything, so it must not be treated as one.
    const listening = run([
      { type: 'SIGN_IN', operator: 'Amina' },
      { type: 'CONSENT_GIVEN' },
      { type: 'START_EMERGENCY', context: SITE },
    ]);
    expect(reducer(listening, { type: 'HUMAN_CONFIRMED' }).phase).toBe('listening');
    expect(reducer(listening, { type: 'HUMAN_CONFIRMED' }).protocol).toBeNull();
  });

  it('lets the human reject a suggestion and start again', () => {
    const rejected = reducer(describedFainting(), { type: 'HUMAN_REJECTED' });
    expect(rejected.phase).toBe('listening');
    expect(rejected.match).toBeNull();
    expect(rejected.protocol).toBeNull();
    expect(rejected.events.some((e) => e.kind === 'rejected')).toBe(true);
  });
});

describe('escalation is recorded, never performed', () => {
  it('records the tap without changing what SANA is doing', () => {
    const guiding = reducer(describedFainting(), { type: 'HUMAN_CONFIRMED' });
    const called = reducer(guiding, { type: 'HUMAN_TAPPED_CALL', number: TEST_NUMBER });
    expect(called.escalated).toBe(true);
    // The dial itself is a tel: link the human taps. Nothing in the flow
    // performs it, so guidance carries on exactly as before.
    expect(called.phase).toBe('guiding');
    expect(called.stepIndex).toBe(guiding.stepIndex);
  });

  it('never escalates on its own', () => {
    const everyOtherAction: Action[] = [
      { type: 'SIGN_IN', operator: 'A' },
      { type: 'CONSENT_GIVEN' },
      { type: 'START_EMERGENCY', context: SITE },
      { type: 'MATCHING' },
      { type: 'UNMATCHED' },
      { type: 'HUMAN_CONFIRMED' },
      { type: 'NEXT_STEP' },
      { type: 'RESOLVE' },
    ];
    expect(run(everyOtherAction).escalated).toBe(false);
  });
});

describe('uncertainty does not become a guess', () => {
  it('refuses to match noise', () => {
    const match = matchProtocol('the weather is quite nice today thank you');
    expect(match === null || match.confidence < CONFIDENCE_THRESHOLD).toBe(true);
  });

  it('offers no protocol at all when unmatched', () => {
    const state = run([
      { type: 'SIGN_IN', operator: 'A' },
      { type: 'CONSENT_GIVEN' },
      { type: 'START_EMERGENCY', context: SITE },
      { type: 'MATCHING' },
      { type: 'UNMATCHED' },
    ]);
    expect(state.phase).toBe('unmatched');
    expect(state.protocol).toBeNull();
    expect(state.match).toBeNull();
  });

  it('matches each protocol from wording a bystander would actually use', () => {
    const cases: readonly [string, string][] = [
      ['he is choking and cannot cough or speak', 'choking-adult'],
      ['she fainted and is not responding', 'fainting-unresponsive'],
      ['he was bitten by a snake on the leg', 'snakebite'],
    ];
    for (const [said, expected] of cases) {
      const match = matchProtocol(said);
      expect(match?.protocol.id, `"${said}"`).toBe(expected);
      expect(match!.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    }
  });
});

describe('the incident record', () => {
  it('is built from events the flow logged, not written afterwards', () => {
    const state = run(
      [{ type: 'HUMAN_CONFIRMED' }, { type: 'NEXT_STEP' }, { type: 'HUMAN_TAPPED_CALL', number: TEST_NUMBER }],
      describedFainting(),
    );
    const kinds = state.events.map((event) => event.kind);
    expect(kinds).toEqual([
      'started',
      'described',
      'suggested',
      'confirmed',
      'step',
      'escalated',
    ]);
    expect(state.events.every((event) => event.at > 0)).toBe(true);
  });

  it('does not carry observations from one incident into the next', () => {
    const finished = reducer(describedFainting(), { type: 'HUMAN_CONFIRMED' });
    const fresh = reducer(finished, { type: 'START_EMERGENCY', context: SITE });
    expect(fresh.protocol).toBeNull();
    expect(fresh.facts).toEqual([]);
    expect(fresh.transcript).toBe('');
    expect(fresh.events.map((e) => e.kind)).toEqual(['started']);
    // The operator is who they were; the incident is not.
    expect(fresh.operator).toBe('Amina');
  });
});

describe('the library the app reads', () => {
  it('is the same three protocols the API hashes', () => {
    expect(PROTOCOLS.map((p) => p.id).sort()).toEqual([
      'choking-adult',
      'fainting-unresponsive',
      'snakebite',
    ]);
  });
});
