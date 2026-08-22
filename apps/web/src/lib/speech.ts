/**
 * Voice in and voice out, using what the browser already has.
 *
 * Speech recognition is the browser's own, so nothing leaves the device and
 * there is no key to configure for the demo. Where it is unavailable the
 * caller falls back to typing — the flow is identical either way, because the
 * screen is the backup channel by design, not an afterthought.
 *
 * Speech synthesis here reads locked library text only. It is a stand-in for
 * the pre-recorded Chatterbox audio, and it never speaks anything a model
 * wrote: every string passed in comes from the frozen library.
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

let currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Speak a line from the library.
 *
 * Paced deliberately slowly. Master prompt section 2: calm is the product, and
 * a frightened person cannot follow speech delivered at conversational speed.
 */
export const speak = (text: string): void => {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
};

export const stopSpeaking = (): void => {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  currentUtterance = null;
};

export const isSpeaking = (): boolean => currentUtterance !== null;
