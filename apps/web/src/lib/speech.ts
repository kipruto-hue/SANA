/**
 * Voice **in** only.
 *
 * Speech recognition is the browser's own, driving the live captions so the
 * screen is never silent while someone is talking. Nothing leaves the device
 * on this path. Where it is unavailable the caller falls back to typing — the
 * flow is identical either way, because the screen is the backup channel by
 * design, not an afterthought.
 *
 * Voice **out** is not here. It used to be: the browser's speech synthesis
 * read locked library text as a stand-in until the real audio existed. It has
 * been removed rather than left as a fallback. SANA has one voice, Fish Audio,
 * playing pre-generated files from `voice.ts`; a second voice that sounds
 * nothing like the first is worse than silence, and synthesising medical
 * wording on the device at read time is what rule nine exists to prevent.
 */

/**
 * Minimal shapes for the Web Speech API, which TypeScript's DOM library does
 * not declare. Only the members actually used are described — a fuller
 * declaration would be fiction, since browser support varies.
 */
interface RecognitionAlternative {
  readonly transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: RecognitionAlternative;
}
interface RecognitionResultList {
  readonly length: number;
  readonly [index: number]: RecognitionResult;
}
interface RecognitionEvent {
  readonly results: RecognitionResultList;
}
interface RecognitionErrorEvent {
  readonly error?: string;
}

type Recognition = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

interface SpeechCapableWindow {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
}

const speechWindow = globalThis as unknown as SpeechCapableWindow;
const RecognitionCtor: (new () => Recognition) | undefined =
  speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

export const speechSupported = (): boolean => RecognitionCtor !== undefined;

export interface Listener {
  stop: () => void;
}

export const listen = (
  onTranscript: (text: string, final: boolean) => void,
  onError: (message: string) => void,
): Listener | null => {
  if (!RecognitionCtor) return null;

  const recognition = new RecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-GB';

  recognition.onresult = (event: RecognitionEvent) => {
    let text = '';
    let final = false;
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (!result) continue;
      text += result[0]?.transcript ?? '';
      if (result.isFinal) final = true;
    }
    onTranscript(text.trim(), final);
  };

  recognition.onerror = (event: RecognitionErrorEvent) => {
    const error = String(event?.error ?? 'unknown');
    // "no-speech" and "aborted" are ordinary, not failures worth surfacing to
    // someone mid-emergency.
    if (error !== 'no-speech' && error !== 'aborted') {
      onError(
        error === 'not-allowed'
          ? 'Microphone permission was refused. You can type what you can see instead.'
          : `Speech recognition stopped (${error}). You can type instead.`,
      );
    }
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
  };
};
