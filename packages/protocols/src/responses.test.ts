import { describe, expect, it } from 'vitest';

import { loadLibrary, readAndHashContent } from './library.js';
import { RESPONSE_INTENTS, ResponseLines } from './schema.js';

/**
 * The conversation library is medicine-adjacent, not medicine — and it is held
 * to the medical standard anyway. These tests are the reason that claim means
 * something.
 */

const library = loadLibrary();

describe('the conversation library is locked like the medical one', () => {
  it('holds exactly one line per intent, and no intent without a line', () => {
    expect(Object.keys(library.responses.lines).sort()).toEqual([...RESPONSE_INTENTS].sort());
  });

  it('is hashed into the manifest and covered by the library hash', () => {
    // If _responses.json were not in the manifest, editing a reassurance would
    // be the one content change SANA could not detect.
    expect(library.manifest.entries['_responses']).toBeDefined();
    const { fileHashes } = readAndHashContent();
    expect(fileHashes.has('_responses.json')).toBe(true);
    expect(library.manifest.entries['_responses']?.file_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is not offered to the protocol selector', () => {
    // The underscore prefix keeps it out of the protocol set, so no id the
    // selector could return can reach a reassurance instead of a protocol.
    expect(library.ids).not.toContain('_responses');
    expect(library.protocols.has('_responses')).toBe(false);
  });

  it('holds SANA to its review gate — nothing here ships as reviewed yet', () => {
    expect(library.responses.clinician_review.status).toBe('pending');
    // And the whole library is not "fully reviewed" while these are pending,
    // which is what stops the UI describing them as signed off.
    expect(
      library.responses.clinician_review.status === 'approved' &&
        library.system.clinician_review.status === 'approved',
    ).toBe(false);
  });

  it('every line carries a note saying when it is spoken', () => {
    for (const [intent, line] of Object.entries(library.responses.lines)) {
      expect(line.note.length, `${intent} has no note`).toBeGreaterThan(20);
      expect(line.audio, `${intent} has no audio path`).toMatch(/^_responses\/.+\.wav$/);
    }
  });
});

describe('a reassurance cannot become a diagnosis', () => {
  const valid = {
    id: '_responses',
    version: '1.0.0',
    description: 'x',
    lines: Object.fromEntries(
      RESPONSE_INTENTS.map((intent) => [
        intent,
        { text: 'Stay with me.', audio: `_responses/${intent}.wav`, note: 'a note about it' },
      ]),
    ),
    clinician_review: { status: 'pending', reviewer: null, date: null },
  };

  it('accepts the shape the real file uses', () => {
    expect(() => ResponseLines.parse(valid)).not.toThrow();
  });

  it('rejects a line that names a cause or a treatment', () => {
    // The same guard the medical steps pass. A warm sentence is exactly where
    // a diagnosis would slip in unnoticed — "it's probably just a faint" reads
    // as kindness and is a clinical claim.
    for (const text of [
      "Don't worry, it's probably just a faint.",
      'This is a case of shock — stay calm.',
      'They are suffering from heat exhaustion, you are doing fine.',
      'Give them a dose of water and keep talking to them.',
    ]) {
      const bad = { ...valid, lines: { ...valid.lines, panic: { ...valid.lines['panic'], text } } };
      expect(() => ResponseLines.parse(bad), text).toThrow();
    }
  });

  it('rejects an unknown intent, and a missing one', () => {
    expect(() =>
      ResponseLines.parse({
        ...valid,
        lines: { ...valid.lines, improvise: { text: 'x', audio: 'y', note: 'z' } },
      }),
    ).toThrow();

    const { unclear: _removed, ...withoutUnclear } = valid.lines;
    expect(() => ResponseLines.parse({ ...valid, lines: withoutUnclear })).toThrow();
  });

  it('will not let a line claim review without naming a reviewer', () => {
    expect(() =>
      ResponseLines.parse({
        ...valid,
        clinician_review: { status: 'approved', reviewer: null, date: null },
      }),
    ).toThrow();
  });
});
