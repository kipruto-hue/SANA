import { describe, expect, it } from 'vitest';

import { crossBoundary } from './nlu.js';
import { PROTOCOLS } from './library.js';

/**
 * The boundary is the safety artefact, so these tests are adversarial: they
 * assume a model that is confidently wrong, or actively trying to be helpful
 * in the way that would hurt someone.
 */

const KNOWN_ID = PROTOCOLS[0]!.id;

describe('only an id and a number cross the boundary', () => {
  it('accepts a known id with a real confidence', () => {
    const selection = crossBoundary({ protocol_id: KNOWN_ID, confidence: 0.8 });
    expect(selection?.protocol.id).toBe(KNOWN_ID);
    expect(selection?.confidence).toBe(0.8);
  });

  it('selects nothing for an id the frozen library does not contain', () => {
    // A hallucinated protocol is the obvious failure. It has to be inert.
    for (const id of ['cardiac-arrest', 'anaphylaxis', '', 'choking-adult-v2', '../_system']) {
      expect(crossBoundary({ protocol_id: id, confidence: 0.99 }), id).toBeNull();
    }
  });

  it('drops medical wording the model tried to send, however it is labelled', () => {
    // The failure this whole file exists to prevent: a model returning steps.
    // Sentinel-marked, so the assertion can tell model wording apart from the
    // library's own. Asserting on plausible first-aid phrases would not: the
    // frozen protocol legitimately contains those, which is the whole point.
    const MODEL = 'MODEL-AUTHORED-WORDING';
    const selection = crossBoundary({
      protocol_id: KNOWN_ID,
      confidence: 0.9,
      steps: [`${MODEL}: give five sharp back blows between the shoulder blades.`],
      instructions: `${MODEL}: lay them flat and begin compressions.`,
      diagnosis: `${MODEL}: probable anaphylactic shock.`,
      spoken_response: `${MODEL}: stay calm, I will guide you.`,
      confirm_prompt: `${MODEL}: it sounds like they are choking. Shall I guide you?`,
    });

    // Nothing beyond the two permitted values survives. The protocol carried
    // on the result is the frozen object itself, so the wording a human will
    // hear is the reviewed wording and nothing else.
    expect(Object.keys(selection!)).toEqual(['protocol', 'confidence']);
    expect(selection!.protocol).toBe(PROTOCOLS[0]);
    expect(JSON.stringify(selection)).not.toContain(MODEL);
  });

  it('refuses a confidence that is not a confidence', () => {
    for (const confidence of [1.5, -0.1, Number.NaN, Infinity, '0.9', null, undefined]) {
      expect(crossBoundary({ protocol_id: KNOWN_ID, confidence }), String(confidence)).toBeNull();
    }
  });

  it('refuses anything that is not the expected shape at all', () => {
    for (const raw of [null, undefined, 'choking-adult', 42, [], [{ protocol_id: KNOWN_ID }]]) {
      expect(crossBoundary(raw), JSON.stringify(raw) ?? 'undefined').toBeNull();
    }
    expect(crossBoundary({ confidence: 0.9 })).toBeNull();
  });

  it('does not let a model escalate, guide, or skip the human', () => {
    // Section 2: escalation is human-initiated and guidance needs a human
    // confirmation. Neither is expressible in what crosses the boundary, which
    // is the point -- there is no field a model could set to reach them.
    const selection = crossBoundary({
      protocol_id: KNOWN_ID,
      confidence: 1,
      escalate: true,
      call_emergency_services: true,
      skip_confirmation: true,
      auto_advance: true,
    });
    expect(Object.keys(selection!)).toEqual(['protocol', 'confidence']);
  });
});
