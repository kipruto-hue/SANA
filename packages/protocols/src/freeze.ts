/**
 * Freeze the protocol library: write manifest.json from what is on disk.
 *
 * Run deliberately, never automatically, and never from the API's start-up
 * path. Freezing is the act of saying "this wording has been reviewed and is
 * what SANA will read aloud". A build step that re-froze silently would make
 * the integrity check meaningless — it would always pass, because it would
 * always be describing whatever happened to be there.
 *
 *   npm run protocols:freeze
 */
import { writeFileSync } from 'node:fs';

import { computeLibraryHash, readAndHashContent, MANIFEST_PATH } from './library.js';
import type { Manifest } from './schema.js';

const { fileHashes, protocols, system, responses, entries } = readAndHashContent();

const manifest: Manifest = {
  generated_by: 'packages/protocols/src/freeze.ts',
  library_sha256: computeLibraryHash(fileHashes),
  entries,
};

writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: 'utf8',
});

const pending = [...protocols.values()].filter((p) => p.clinician_review.status === 'pending');
const contentPending = [
  ...(system.clinician_review.status === 'pending' ? ['_system'] : []),
  ...(responses.clinician_review.status === 'pending' ? ['_responses'] : []),
];
const steps = [...protocols.values()].reduce((n, p) => n + p.steps.length, 0);
const withAudio = Object.values(entries).reduce(
  (n, e) => n + Object.values(e.steps).filter((s) => s.audio_sha256 !== null).length,
  0,
);

console.log(
  `frozen: ${protocols.size} protocols, ${steps} steps, ` +
    `${Object.keys(system.lines).length} system lines, ` +
    `${Object.keys(responses.lines).length} response lines`,
);
console.log(`  library_sha256: ${manifest.library_sha256}`);
console.log(`  audio recorded: ${withAudio}/${steps} steps`);
if (pending.length > 0) {
  console.log(
    `  awaiting clinician sign-off: ${[...pending.map((p) => p.id), ...contentPending].join(', ')} ` +
      '(the UI states this; do not describe these scripts as "reviewed")',
  );
}
