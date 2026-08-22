import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CONTENT_DIR, loadLibrary, isFullyReviewed, LibraryIntegrityError } from './library.js';
import { ClinicianReview, Protocol } from './schema.js';

/**
 * Edit a content file for the duration of one test, then put it back exactly.
 * Byte-level so the restored file re-hashes to the frozen value.
 */
const tamperWith = (file: string, mutate: (json: any) => void): (() => void) => {
  const path = join(CONTENT_DIR, file);
  const original = readFileSync(path);
  const json = JSON.parse(original.toString('utf8'));
  mutate(json);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return () => writeFileSync(path, original);
};

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe('the frozen library', () => {
  it('loads and matches its manifest', () => {
    const library = loadLibrary();
    expect(library.ids).toEqual(['choking-adult', 'fainting-unresponsive', 'snakebite']);
    expect(library.protocols.size).toBe(3);
  });

  it('reports the demo scripts as not yet clinician-reviewed', () => {
    // Master prompt section 10 leaves sign-off open. Until a named clinician
    // has signed, nothing may describe these scripts as "reviewed" — the UI
    // reads this flag and says so.
    expect(isFullyReviewed(loadLibrary())).toBe(false);
  });

  it('gives every step a locked audio path so recordings can be bound to wording', () => {
    for (const protocol of loadLibrary().protocols.values()) {
      for (const step of protocol.steps) {
        expect(step.audio).toBe(`${protocol.id}/${String(step.n).padStart(2, '0')}.wav`);
      }
    }
  });
});

describe('integrity — SANA refuses to run against content that changed after review', () => {
  it('rejects an edited step, even a harmless-looking one', () => {
    restore = tamperWith('choking-adult.json', (json) => {
      json.steps[0].text = `${json.steps[0].text} Please stay calm.`;
    });
    expect(() => loadLibrary()).toThrow(LibraryIntegrityError);
    expect(() => loadLibrary()).toThrow(/wording has changed since it was frozen/);
  });

  it('rejects a reordered protocol even though the wording is untouched', () => {
    // Reordering is the subtle one: every sentence is still reviewed content,
    // so a naive per-sentence check would pass. Order is clinical meaning —
    // back blows before abdominal thrusts is not a stylistic choice.
    restore = tamperWith('choking-adult.json', (json) => {
      const [a, b] = [json.steps[2], json.steps[3]];
      json.steps[2] = { ...b, n: 3 };
      json.steps[3] = { ...a, n: 4 };
    });
    expect(() => loadLibrary()).toThrow(/wording has changed since it was frozen/);
  });

  it('rejects a protocol that has been removed from disk', () => {
    restore = tamperWith('snakebite.json', (json) => {
      json.id = 'snakebite-v2';
    });
    expect(() => loadLibrary()).toThrow(/not in the file its id names/);
  });

  it('names every failure rather than reporting only the first', () => {
    restore = tamperWith('fainting-unresponsive.json', (json) => {
      json.steps[0].text = 'Something else entirely.';
      json.steps[1].text = 'And another thing.';
    });
    try {
      loadLibrary();
      expect.unreachable('the library should not have loaded');
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryIntegrityError);
      expect((error as LibraryIntegrityError).failures.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the schema refuses content SANA must never say', () => {
  const valid = () => JSON.parse(readFileSync(join(CONTENT_DIR, 'snakebite.json'), 'utf8'));

  it.each([
    ['a diagnosis', 'This is probably a viper bite, so treat it as neurotoxic.'],
    ['a named cause', 'The swelling is caused by venom spreading through the tissue.'],
    ['a prescription', 'Give them 500 mg of paracetamol for the pain.'],
  ])('rejects step text containing %s', (_label, text) => {
    const json = valid();
    json.steps[0].text = text;
    expect(() => Protocol.parse(json)).toThrow(/observable facts/);
  });

  it('accepts an instruction phrased as an action', () => {
    const json = valid();
    json.steps[0].text = 'Keep them still and support the limb.';
    expect(() => Protocol.parse(json)).not.toThrow();
  });

  it('rejects steps that are not numbered in order', () => {
    const json = valid();
    json.steps[1].n = 5;
    expect(() => Protocol.parse(json)).toThrow(/numbered 1\.\.n in order/);
  });

  it('rejects unknown fields rather than carrying unreviewed content', () => {
    const json = valid();
    json.steps[0].urgency = 'high';
    expect(() => Protocol.parse(json)).toThrow();
  });

  it('refuses to call a protocol approved without naming who approved it', () => {
    expect(() =>
      ClinicianReview.parse({ status: 'approved', reviewer: null, date: null }),
    ).toThrow(/must name its reviewer/);
    expect(() =>
      ClinicianReview.parse({ status: 'approved', reviewer: 'Dr A. Nasser', date: '2026-08-24' }),
    ).not.toThrow();
  });
});

describe('the locked system lines', () => {
  it('sends the human to real help when SANA cannot match', () => {
    // Master prompt section 3, graceful uncertainty. This line is the reason
    // the model is never allowed to author prose: an uncertain system that can
    // generate text will fill the silence with something plausible instead.
    const { unmatched } = loadLibrary().system.lines;
    expect(unmatched.text).toMatch(/won't guess/i);
    expect(unmatched.text).toMatch(/call for help/i);
  });

  it('has a line for a missing emergency number that does not invent one', () => {
    // Decision 0003: a wrong emergency number is worse than a missing one.
    const { no_emergency_number } = loadLibrary().system.lines;
    expect(no_emergency_number.text).not.toMatch(/\b\d{3,4}\b/);
    expect(no_emergency_number.text).toMatch(/can't dial|cannot dial/i);
  });

  it('never states a specific emergency number anywhere in the library', () => {
    // The number is contextual data, read at runtime. If it were baked into a
    // recorded line, changing site would mean re-recording the audio — and a
    // stale recording would read the wrong number aloud in an emergency.
    const library = loadLibrary();
    const everything = [
      ...Object.values(library.system.lines).map((l) => l.text),
      ...[...library.protocols.values()].flatMap((p) => [
        p.confirm_prompt,
        ...p.steps.map((s) => s.text),
      ]),
    ];
    for (const text of everything) {
      expect(text, `"${text}" hard-codes an emergency number`).not.toMatch(
        /\b(999|911|112|998|9-1-1)\b/,
      );
    }
  });
});
