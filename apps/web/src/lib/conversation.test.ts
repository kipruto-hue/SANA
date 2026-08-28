import { describe, expect, it } from 'vitest';

import { EMPTY_CONTEXT } from './context.js';
import { initialState, reducer, type Action, type State } from './flow.js';
import { deriveHandover, actionLines } from './handover.js';
import { extends_ } from './log.js';
import { matchProtocol, RESPONSE_INTENTS, type ResponseIntent } from './library.js';

/**
 * The conversational upgrade is additive, and "additive" is a claim that has
 * to be tested rather than asserted. These tests ask one question in several
 * ways: can speaking to SANA reach anything that tapping could not?
 */

const TEST_NUMBER = 'TEST-NUMBER-NOT-DIALLABLE';
const SITE = { ...EMPTY_CONTEXT, site: 'Lusail Tower B', emergencyNumber: TEST_NUMBER };
const SAID = 'she collapsed and will not wake up but she is still breathing';

const run = (actions: readonly Action[], from: State = initialState): State =>
  actions.reduce(reducer, from);

const heard = (intent: ResponseIntent, transcript = 'something spoken'): Action => ({
  type: 'HEARD_RESPONSE',
  transcript,
  language: 'en',
  intent,
  selector: 'llm',
});

/** A confirmed protocol, guidance under way, sitting on step 1. */
const guiding = (): State =>
  run([
    { type: 'SIGN_IN', operator: 'Amina' },
    { type: 'CONSENT_GIVEN' },
    { type: 'START_EMERGENCY', context: SITE },
    { type: 'TRANSCRIPT', text: SAID },
    { type: 'MATCHING', language: 'en', source: 'on-device' },
    { type: 'MATCHED', match: matchProtocol(SAID)! },
    { type: 'HUMAN_CONFIRMED' },
  ]);

describe('voice cannot open the door that a human opens', () => {
  it('cannot reach guiding from any earlier phase, whatever it hears', () => {
    // The single most important property in the codebase. Voice arrives from
    // outside and must not be able to start guidance from anywhere.
    const before: State[] = [
      initialState,
      run([{ type: 'SIGN_IN', operator: 'Amina' }]),
      run([{ type: 'SIGN_IN', operator: 'Amina' }, { type: 'CONSENT_GIVEN' }]),
      run([
        { type: 'SIGN_IN', operator: 'Amina' },
        { type: 'CONSENT_GIVEN' },
        { type: 'START_EMERGENCY', context: SITE },
        { type: 'TRANSCRIPT', text: SAID },
        { type: 'MATCHING', language: 'en', source: 'on-device' },
        { type: 'MATCHED', match: matchProtocol(SAID)! },
      ]),
    ];

    for (const state of before) {
      for (const intent of RESPONSE_INTENTS) {
        expect(
          reducer(state, heard(intent)).phase,
          `"${intent}" at phase "${state.phase}" must not start guidance`,
        ).not.toBe('guiding');
      }
      // Nor may it arm the listener outside guidance.
      expect(reducer(state, { type: 'AWAIT_RESPONSE' }).awaitingResponse).toBe(false);
    }
  });

  it('records a reply spoken outside guidance rather than losing it', () => {
    // It must not act on it. It must still write it down.
    const state = run([{ type: 'SIGN_IN', operator: 'Amina' }, { type: 'CONSENT_GIVEN' }]);
    const after = reducer(state, heard('ready', 'go on then'));
    expect(after.phase).toBe(state.phase);
    expect(after.events.at(-1)?.kind).toBe('heard');
    expect(after.events.at(-1)?.data?.['transcript']).toBe('go on then');
  });
});

describe('only "ready" advances, and it advances the normal way', () => {
  it('moves exactly one step, the same as the Next button', () => {
    const start = guiding();
    const byVoice = reducer(start, heard('ready'));
    const byTap = reducer(start, { type: 'NEXT_STEP' });

    expect(byVoice.stepIndex).toBe(1);
    // The identical destination is the point: voice has no path of its own.
    expect(byVoice.stepIndex).toBe(byTap.stepIndex);
    expect(byVoice.phase).toBe(byTap.phase);
    expect(byVoice.furthestStep).toBe(byTap.furthestStep);
  });

  it('holds the step for every other intent', () => {
    const start = guiding();
    for (const intent of ['repeat', 'panic', 'changed', 'unclear'] as const) {
      const after = reducer(start, heard(intent));
      expect(after.stepIndex, `"${intent}" must not advance`).toBe(start.stepIndex);
      expect(after.phase, `"${intent}" must stay in guidance`).toBe('guiding');
    }
  });

  it('ends the session on "stop", and opens the handover', () => {
    const after = reducer(guiding(), heard('stop', 'the paramedics are here'));
    expect(after.phase).toBe('resolved');
    expect(after.screen).toBe('handover');
  });

  it('stops listening the moment a reply is handled', () => {
    const armed = reducer(guiding(), { type: 'AWAIT_RESPONSE' });
    expect(armed.awaitingResponse).toBe(true);
    for (const intent of RESPONSE_INTENTS) {
      expect(reducer(armed, heard(intent)).awaitingResponse, intent).toBe(false);
    }
  });
});

describe('the buttons still own the session', () => {
  it('taps work exactly as before while SANA is listening', () => {
    const armed = reducer(guiding(), { type: 'AWAIT_RESPONSE' });

    const next = reducer(armed, { type: 'NEXT_STEP' });
    expect(next.stepIndex).toBe(1);
    // A tap cancels the listen: whatever was being said was about the old step.
    expect(next.awaitingResponse).toBe(false);

    const back = reducer(next, { type: 'PREV_STEP' });
    expect(back.stepIndex).toBe(0);
    expect(back.awaitingResponse).toBe(false);
  });

  it('a tap and a spoken "ready" produce the same record shape', () => {
    const start = guiding();
    const spoken = reducer(start, heard('ready'));
    const tapped = reducer(start, { type: 'NEXT_STEP' });

    // The spoken path writes one extra event -- what was heard -- and then the
    // same step event. It never writes a different step event.
    expect(spoken.events.at(-1)?.kind).toBe('step');
    expect(tapped.events.at(-1)?.kind).toBe('step');
    expect(spoken.events.at(-1)?.data).toEqual(tapped.events.at(-1)?.data);
  });
});

describe('the conversation is recorded like everything else', () => {
  it('only ever appends to the log', () => {
    let state = guiding();
    for (const action of [
      { type: 'AWAIT_RESPONSE' } as const,
      heard('panic', 'I am scared'),
      { type: 'SPOKE_RESPONSE', intent: 'panic', outcome: 'played' } as const,
      { type: 'AWAIT_RESPONSE' } as const,
      heard('ready', 'ok ready'),
      { type: 'CANCEL_AWAIT' } as const,
    ]) {
      const next = reducer(state, action);
      expect(extends_(state.events, next.events), `${action.type} rewrote the log`).toBe(true);
      state = next;
    }
  });

  it('stores only a reference to the locked line, never its wording', () => {
    const after = reducer(guiding(), {
      type: 'SPOKE_RESPONSE',
      intent: 'panic',
      outcome: 'played',
    });
    const event = after.events.at(-1)!;
    expect(event.data?.['intent']).toBe('panic');
    // The reassurance itself lives in the frozen library and nowhere else.
    expect(JSON.stringify(event)).not.toContain('One step at a time');
  });

  it('puts distress and new reports on the handover, with the step and the time', () => {
    const state = run(
      [
        { type: 'AWAIT_RESPONSE' },
        heard('panic', 'I am scared'),
        { type: 'SPOKE_RESPONSE', intent: 'panic', outcome: 'played' },
        heard('ready', 'ok'),
        heard('changed', 'she is breathing differently now'),
      ],
      guiding(),
    );

    const record = deriveHandover(state.events);
    expect(record.conversation).toHaveLength(3);
    expect(record.conversation[0]?.intent).toBe('panic');
    expect(record.conversation[0]?.step).toBe(1);
    // The report of a change is attributed to the step it happened on.
    expect(record.conversation[2]?.step).toBe(2);

    const lines = actionLines(record, 'nothing').join(' ');
    expect(lines).toContain('Distress was expressed at step 1');
    // The person's own words, not SANA's characterisation of them.
    expect(lines).toContain('she is breathing differently now');
    expect(lines).not.toMatch(/deteriorat|worsen|serious|critical/i);
  });
});
