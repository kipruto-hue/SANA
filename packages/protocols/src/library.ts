import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Manifest, Protocol, SystemLines } from './schema.js';
import type {
  Manifest as ManifestType,
  Protocol as ProtocolType,
  SystemLines as SystemLinesType,
} from './schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(HERE, '..');
export const CONTENT_DIR = join(PACKAGE_ROOT, 'content');
export const AUDIO_DIR = join(PACKAGE_ROOT, 'audio');
export const MANIFEST_PATH = join(PACKAGE_ROOT, 'manifest.json');

export const sha256 = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');

/**
 * Thrown when the library on disk is not the library the manifest describes.
 *
 * The API treats this as fatal at boot. That is the point: if the medical
 * content has changed without being re-frozen and re-reviewed, SANA must not
 * run at all. A first-aid tool that starts anyway and reads unreviewed steps
 * aloud is worse than one that refuses to start.
 */
export class LibraryIntegrityError extends Error {
  override readonly name = 'LibraryIntegrityError';
  constructor(
    message: string,
    readonly failures: readonly string[],
  ) {
    super(`${message}\n  - ${failures.join('\n  - ')}`);
  }
}

export interface Library {
  readonly protocols: ReadonlyMap<string, ProtocolType>;
  readonly system: SystemLinesType;
  readonly manifest: ManifestType;
  /** Every protocol id, sorted. The only ids the NLU boundary will accept. */
  readonly ids: readonly string[];
}

const contentFiles = (): string[] =>
  readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

/**
 * Read the raw bytes of a content file.
 *
 * Deliberately byte-level rather than parse-then-reserialise: the hash must
 * cover exactly what a reviewer read, including formatting. `.gitattributes`
 * pins these files to LF so the bytes are stable across platforms.
 */
const readContent = (file: string): Buffer => readFileSync(join(CONTENT_DIR, file));

/** The hash of the whole library: every file hash, in a fixed order. */
export const computeLibraryHash = (fileHashes: ReadonlyMap<string, string>): string => {
  const lines = [...fileHashes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, hash]) => `${file}:${hash}`)
    .join('\n');
  return sha256(lines);
};

export interface FrozenShape {
  readonly manifest: ManifestType;
  readonly protocols: Map<string, ProtocolType>;
  readonly system: SystemLinesType;
}

/**
 * Parse and validate every content file, and compute what the manifest for
 * them *should* say. Used both to freeze the library and to verify it.
 */
export const readAndHashContent = (): {
  fileHashes: Map<string, string>;
  protocols: Map<string, ProtocolType>;
  system: SystemLinesType;
  entries: ManifestType['entries'];
} => {
  const files = contentFiles();
  if (files.length === 0) {
    throw new LibraryIntegrityError('the protocol library is empty', [CONTENT_DIR]);
  }

  const fileHashes = new Map<string, string>();
  const protocols = new Map<string, ProtocolType>();
  const entries: ManifestType['entries'] = {};
  let system: SystemLinesType | undefined;

  for (const file of files) {
    const bytes = readContent(file);
    fileHashes.set(file, sha256(bytes));
    const json: unknown = JSON.parse(bytes.toString('utf8'));

    if (file === '_system.json') {
      system = SystemLines.parse(json);
      entries[system.id] = { file_sha256: sha256(bytes), steps: {} };
      continue;
    }

    const protocol = Protocol.parse(json);
    if (`${protocol.id}.json` !== file) {
      throw new LibraryIntegrityError('a protocol is not in the file its id names', [
        `${file} declares id "${protocol.id}"`,
      ]);
    }
    protocols.set(protocol.id, protocol);

    const steps: ManifestType['entries'][string]['steps'] = {};
    for (const step of protocol.steps) {
      const audioPath = join(AUDIO_DIR, step.audio);
      steps[String(step.n)] = {
        text_sha256: sha256(step.text),
        // Audio is generated later (tools/generate_audio.py). Binding its hash
        // to the step here is what makes a recording that no longer matches its
        // script a build failure rather than a surprise in front of investors.
        audio_sha256: existsSync(audioPath) ? sha256(readFileSync(audioPath)) : null,
      };
    }
    entries[protocol.id] = { file_sha256: sha256(bytes), steps };
  }

  if (!system) {
    throw new LibraryIntegrityError('the library has no _system.json', [
      'SANA would have no locked wording for the case where it cannot match',
    ]);
  }

  return { fileHashes, protocols, system, entries };
};

/**
 * Load the library and prove it is the one that was frozen.
 *
 * @throws LibraryIntegrityError if any file, or the library as a whole, does
 * not hash to what the manifest recorded.
 */
export const loadLibrary = (): Library => {
  if (!existsSync(MANIFEST_PATH)) {
    throw new LibraryIntegrityError('the protocol library has never been frozen', [
      `${MANIFEST_PATH} does not exist — run \`npm run protocols:freeze\``,
    ]);
  }

  const manifest = Manifest.parse(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
  const { fileHashes, protocols, system, entries } = readAndHashContent();

  const failures: string[] = [];

  for (const [id, entry] of Object.entries(entries)) {
    const recorded = manifest.entries[id];
    if (!recorded) {
      failures.push(`"${id}" is on disk but not in the manifest — it was never frozen`);
      continue;
    }
    if (recorded.file_sha256 !== entry.file_sha256) {
      failures.push(`"${id}" has been edited since it was frozen`);
    }
    for (const [n, hashes] of Object.entries(entry.steps)) {
      const recordedStep = recorded.steps[n];
      if (!recordedStep) {
        failures.push(`"${id}" step ${n} is not in the manifest`);
        continue;
      }
      if (recordedStep.text_sha256 !== hashes.text_sha256) {
        failures.push(`"${id}" step ${n} wording has changed since it was frozen`);
      }
      // Only enforced once a recording exists. Before that the step is text-only
      // and the UI reads it on screen.
      if (
        hashes.audio_sha256 !== null &&
        recordedStep.audio_sha256 !== null &&
        recordedStep.audio_sha256 !== hashes.audio_sha256
      ) {
        failures.push(`"${id}" step ${n} audio no longer matches its script`);
      }
    }
  }

  for (const id of Object.keys(manifest.entries)) {
    if (!(id in entries)) {
      failures.push(`"${id}" is in the manifest but missing from disk`);
    }
  }

  const libraryHash = computeLibraryHash(fileHashes);
  if (libraryHash !== manifest.library_sha256) {
    failures.push(
      `library hash mismatch: expected ${manifest.library_sha256}, computed ${libraryHash}`,
    );
  }

  if (failures.length > 0) {
    throw new LibraryIntegrityError(
      'the protocol library does not match its manifest. SANA will not run ' +
        'against medical content that has changed since it was reviewed. ' +
        'If the change is intended, re-freeze with `npm run protocols:freeze` ' +
        'and get the content re-reviewed',
      failures,
    );
  }

  return {
    protocols,
    system,
    manifest,
    ids: [...protocols.keys()].sort(),
  };
};

/** True when every protocol has a named clinician sign-off. */
export const isFullyReviewed = (library: Library): boolean =>
  [...library.protocols.values()].every((p) => p.clinician_review.status === 'approved') &&
  library.system.clinician_review.status === 'approved';
