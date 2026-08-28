/**
 * SANA's voice — master prompt section 1.4.
 *
 * There is exactly one voice in this project, and it is Fish Audio. The
 * browser's own speech synthesis has been removed rather than kept as a
 * fallback, deliberately: a second voice that sounds nothing like the first is
 * worse than silence, and a fallback that speaks medical wording generated on
 * the device at read time is precisely what rule nine forbids.
 *
 * So this module plays **files**. Locked protocol steps and the eight locked
 * system lines are generated ahead of time from the frozen library text, stored
 * locally under `public/audio/`, and played from disk — which is what makes the
 * guidance work with no network once a protocol is confirmed.
 *
 * When a file is not there, SANA is silent and the screen carries the step. It
 * does not improvise a voice to fill the gap. The caller records the miss, so
 * a run with no audio is visible in the record rather than merely quiet.
 */

/** Where generated audio is served from, relative to the app root. */
const BASE = 'audio';

export type PlayResult = 'played' | 'missing' | 'unsupported';

let current: HTMLAudioElement | null = null;

export const stopVoice = (): void => {
  if (!current) return;
  current.pause();
  current.src = '';
  current = null;
};

/**
 * Play one locked line.
 *
 * `path` is the `audio` field from the frozen library — the library decides
 * what a line sounds like, the same way it decides what it says.
 */
export const play = async (path: string): Promise<PlayResult> => {
  if (typeof Audio === 'undefined') return 'unsupported';
  stopVoice();

  const audio = new Audio(`${BASE}/${path}`);
  current = audio;

  return new Promise<PlayResult>((resolve) => {
    const done = (result: PlayResult) => {
      if (current === audio) current = null;
      resolve(result);
    };
    audio.onended = () => done('played');
    // A missing file is the ordinary case until the voice has been generated.
    // Silence is the correct behaviour, not an error worth interrupting for.
    audio.onerror = () => done('missing');
    audio.play().catch(() => done('missing'));
  });
};

/**
 * The audio path for a protocol's confirm prompt.
 *
 * By convention rather than a field in the content files: adding one would
 * change every protocol's hash, and the frozen library changes only through a
 * deliberate reviewed update — not to make a filename tidier.
 */
export const confirmAudio = (protocolId: string): string => `${protocolId}/confirm.wav`;

/**
 * Whether the conversation lines have actually been recorded.
 *
 * The listening loop switches itself on from this rather than from a setting.
 * A conversational SANA that listens and then says nothing is a worse
 * experience than the stepper it replaces, so the upgrade should only present
 * itself once it has a voice to present with — and nobody should have to
 * remember to flip a switch on the morning of a demo.
 */
export const responsesAvailable = async (): Promise<boolean> => {
  if (typeof fetch === 'undefined') return false;
  try {
    const response = await fetch(`${BASE}/_responses/ready.wav`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
