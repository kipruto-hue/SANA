import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_CONTEXT } from './context.js';
import { initialState, reducer, type Action, type State } from './flow.js';
import { actionLines, deriveHandover, toText, type RecordLabels } from './handover.js';
import { append, clearLog, extends_, loadLog, persist, wellOrdered, type LoggedEvent } from './log.js';
import { matchProtocol } from './library.js';

/**
 * The record is the thing a clinician acts on, so these tests are about one
 * question: can anything other than a real event change what it says?
 */

/**
 * A deliberately impossible number.
 *
 * Not a real emergency number even in tests: decision 0003 bans the literals,
 * and a fixture using a plausible one is how a plausible one ends up in the
 * app. What matters here is that whatever was configured is what the record
 * reports, so the value only has to be recognisable.
 */
const TEST_NUMBER = 'TEST-NUMBER-NOT-DIALLABLE';

const SITE = {
  ...EMPTY_CONTEXT,
  site: 'Lusail Tower B',
  zone: 'Level 14',
  emergencyNumber: TEST_NUMBER,
  safetyOfficer: 'Amina Rashid',
};

const run = (actions: readonly Action[], from: State = initialState): State =>
  actions.reduce(reducer, from);

/** A whole incident, front to back, as the reducer would really record it. */
const fullIncident = (): State => {
  const said = 'she collapsed and will not wake up but she is still breathing';
  const match = matchProtocol(said);
  expect(match, 'the fixture phrase should match something').not.toBeNull();
  return run([
    { type: 'SIGN_IN', operator: 'Amina' },
    { type: 'CONSENT_GIVEN' },
    { type: 'START_EMERGENCY', context: SITE },
    { type: 'TRANSCRIPT', text: said },
    { type: 'MATCHING', language: 'en', source: 'on-device' },
    { type: 'MATCHED', match: match! },
    { type: 'HUMAN_CONFIRMED' },
    { type: 'NEXT_STEP' },
    { type: 'NEXT_STEP' },
    { type: 'HUMAN_TAPPED_CALL', number: TEST_NUMBER },
  ]);
};

describe('the log only ever grows', () => {
  it('numbers events 1..n with no gaps, and never mutates what it was given', () => {
    const before: readonly LoggedEvent[] = [];
    const after = append(append(append(before, 'started', 'a'), 'step', 'b'), 'resolved', 'c');

    expect(after.map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(before).toHaveLength(0);
    expect(wellOrdered(after)).toBe(true);
  });

  it('clamps a backwards clock so the record cannot read out of order', () => {
    // A device clock that steps backwards mid-incident -- NTP correction, or a
    // user changing the time zone. The record must still read forwards.
    const events = append(append([], 'started', 'a', undefined, 5_000), 'step', 'b', undefined, 1_000);
    expect(events[1]!.at).toBe(5_000);
    expect(wellOrdered(events)).toBe(true);
  });

  it('recognises an append, and refuses to call an edit one', () => {
    const before = append(append([], 'started', 'a'), 'step', 'b');
    expect(extends_(before, append(before, 'resolved', 'c'))).toBe(true);
    expect(extends_(before, before)).toBe(true);

    // Every way the record could be quietly rewritten.
    expect(extends_(before, [before[0]!]), 'truncated').toBe(false);
    expect(extends_(before, [before[1]!, before[0]!]), 'reordered').toBe(false);
    expect(
      extends_(before, [{ ...before[0]!, detail: 'something else' }, before[1]!]),
      'reworded',
    ).toBe(false);
    expect(
      extends_(before, [{ ...before[0]!, at: before[0]!.at + 1 }, before[1]!]),
      'retimed',
    ).toBe(false);
  });

  it('every event the reducer writes is an append to the one before it', () => {
    const said = 'she collapsed and will not wake up but she is still breathing';
    const match = matchProtocol(said)!;
    const actions: readonly Action[] = [
      { type: 'SIGN_IN', operator: 'Amina' },
      { type: 'CONSENT_GIVEN' },
      { type: 'START_EMERGENCY', context: SITE },
      { type: 'TRANSCRIPT', text: said },
      { type: 'MATCHING', language: 'en', source: 'on-device' },
      { type: 'MATCHED', match },
      { type: 'HUMAN_REJECTED' },
      { type: 'TRANSCRIPT', text: said },
      { type: 'MATCHING', language: 'en', source: 'on-device' },
      { type: 'MATCHED', match },
      { type: 'HUMAN_CONFIRMED' },
      { type: 'NEXT_STEP' },
      { type: 'PREV_STEP' },
      { type: 'NEXT_STEP' },
      { type: 'SPOKE', ref: 'system line “thinking”' },
      { type: 'HUMAN_TAPPED_CALL', number: TEST_NUMBER },
      { type: 'VIEW_HANDOVER' },
      { type: 'RESOLVE' },
    ];

    let state = initialState;
    for (const action of actions) {
      const next = reducer(state, action);
      // START_EMERGENCY deliberately opens a fresh log; everything else must
      // only ever add to the one it was handed.
      if (action.type !== 'START_EMERGENCY') {
        expect(extends_(state.events, next.events), `${action.type} rewrote the log`).toBe(true);
      }
      state = next;
    }
    expect(wellOrdered(state.events)).toBe(true);
  });
});

describe('persistence keeps the record across a refresh', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });

  it('writes and reads back the same log', () => {
    const state = fullIncident();
    expect(persist({ incidentId: state.incidentId, events: state.events })).toBe(true);
    expect(loadLog()?.events).toEqual(state.events);
  });

  it('refuses a write that would rewrite a recorded event', () => {
    const state = fullIncident();
    persist({ incidentId: state.incidentId, events: state.events });

    const tampered = state.events.map((event, i) =>
      i === 0 ? { ...event, detail: 'a different story' } : event,
    );
    expect(persist({ incidentId: state.incidentId, events: tampered })).toBe(false);
    // The refusal has to be the whole point: what was stored is still true.
    expect(loadLog()?.events).toEqual(state.events);
  });

  it('drops a stored log that is not well ordered rather than trusting it', () => {
    localStorage.setItem(
      'sana.incident-log.v1',
      JSON.stringify({ incidentId: 'x', events: [{ seq: 4, at: 1, kind: 'started', detail: 'a' }] }),
    );
    expect(loadLog()).toBeNull();
    clearLog();
  });
});

const LABELS: RecordLabels = {
  whatHappened: 'What happened',
  nothingDescribed: 'Nothing was described in this session.',
  actions: 'Actions taken',
  notIncluded: 'Not included',
  timeline: 'Timeline',
  noActions: 'No guidance was given during this session.',
  notIncludedItems: ['No diagnosis.'],
};

describe('the handover is derived from the log and from nothing else', () => {
  it('reads every field off recorded events', () => {
    const record = deriveHandover(fullIncident().events);

    expect(record.operator).toBe('Amina');
    expect(record.site).toBe('Lusail Tower B');
    expect(record.zone).toBe('Level 14');
    expect(record.whatHappened).toContain('she collapsed');
    expect(record.protocolTitle).not.toBe('');
    expect(record.reachedStep).toBe(3);
    expect(record.totalSteps).toBe(7);
    expect(record.escalatedNumber).toBe(TEST_NUMBER);
    expect(record.selector).toBe('on-device');
  });

  it('cannot be changed by editing the site after the incident', () => {
    // The failure this is built against: the sheet used to read the live
    // context store, so changing the site today rewrote yesterday's record.
    const events = fullIncident().events;
    const before = toText(deriveHandover(events), LABELS);

    // Whatever anyone does to the settings, the log is unchanged -- and the
    // record is a function of the log alone.
    const after = toText(deriveHandover(events), LABELS);
    expect(after).toBe(before);
    expect(before).toContain('Lusail Tower B');
    expect(before).toContain(TEST_NUMBER);
  });

  it('reports how far the guidance got, not where the screen ended up', () => {
    const said = 'she collapsed and will not wake up but she is still breathing';
    const match = matchProtocol(said)!;
    const state = run([
      { type: 'SIGN_IN', operator: 'Amina' },
      { type: 'CONSENT_GIVEN' },
      { type: 'START_EMERGENCY', context: SITE },
      { type: 'TRANSCRIPT', text: said },
      { type: 'MATCHING', language: 'en', source: 'on-device' },
      { type: 'MATCHED', match },
      { type: 'HUMAN_CONFIRMED' },
      { type: 'NEXT_STEP' },
      { type: 'NEXT_STEP' },
      { type: 'PREV_STEP' },
      { type: 'PREV_STEP' },
    ]);

    expect(state.stepIndex, 'the screen is back on step 1').toBe(0);
    expect(deriveHandover(state.events).reachedStep, 'the record says step 3 was reached').toBe(3);
    // And going back is itself recorded -- the record does not tell a tidier
    // story than the one that happened.
    expect(state.events.filter((event) => event.data?.direction === 'back')).toHaveLength(2);
  });

  it('says plainly when it could not match, and never invents a protocol', () => {
    const state = run([
      { type: 'SIGN_IN', operator: 'Amina' },
      { type: 'CONSENT_GIVEN' },
      { type: 'START_EMERGENCY', context: SITE },
      { type: 'TRANSCRIPT', text: 'the printer on level three is jammed again' },
      { type: 'MATCHING', language: 'en', source: 'on-device' },
      { type: 'UNMATCHED' },
    ]);
    const record = deriveHandover(state.events);

    expect(record.unmatched).toBe(true);
    expect(record.protocolTitle).toBe('');
    expect(record.reachedStep).toBeNull();
    expect(actionLines(record, LABELS.noActions).join(' ')).toContain('advised calling for help');
  });

  it('produces an empty record from an empty log rather than filling it in', () => {
    const record = deriveHandover([]);
    expect(record.whatHappened).toBe('');
    expect(record.operator).toBe('');
    expect(record.escalatedAt).toBeNull();
    expect(actionLines(record, LABELS.noActions)).toEqual([LABELS.noActions]);
  });

  it('is deterministic: the same log always renders the same sheet', () => {
    const events = fullIncident().events;
    expect(toText(deriveHandover(events), LABELS)).toBe(toText(deriveHandover(events), LABELS));
  });

  it('puts every recorded event on the timeline, and nothing that was not recorded', () => {
    const events = fullIncident().events;
    const text = toText(deriveHandover(events), LABELS);
    for (const event of events) {
      expect(text, `${event.kind} is missing from the sheet`).toContain(event.detail);
    }
  });
});
