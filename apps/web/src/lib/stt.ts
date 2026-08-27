import { configured, stt, TIMEOUT_MS } from './providers.js';

/**
 * The ears — master prompt section 1.1.
 *
 * Whisper hears the speaker, detects the language *from the audio*, and
 * transcribes. It does not interpret, diagnose or decide, and nothing here
 * asks it to: the only things read off the response are the text and the
 * language tag.
 *
 * Language detection belongs here and nowhere else. Not a setting a person
 * chooses under stress, and not something the selector infers downstream from
 * words it happens to recognise — by then the audio is gone, and a wrong guess
 * is unrecoverable.
 *
 * Two channels run together while a turn is being spoken:
 *
 *   - the browser's own recognition, for the live captions, so the screen is
 *     never silent while someone is talking; and
 *   - a recording, sent to Whisper when the turn ends, which is the transcript
 *     the record keeps.
 *
 * Where Whisper is not configured or does not answer, the browser's transcript
 * is used instead and the difference is recorded. Neither path sends anything
 * anywhere the other does not — the browser path stays on the device entirely.
 */

export interface Heard {
  readonly text: string;
  /** BCP-47-ish tag as the provider reported it, or '' when unknown. */
  readonly language: string;
  readonly source: 'whisper' | 'on-device';
}

export const whisperConfigured = (): boolean => configured(stt());

export interface Turn {
  /** Ends the recording and returns the audio, or null if nothing was captured. */
  readonly stop: () => Promise<Blob | null>;
  /** Abandons the recording and releases the microphone. */
  readonly cancel: () => void;
}

/**
 * Record one turn of speech.
 *
 * The stream is stopped explicitly on both paths: a microphone left open after
 * an incident is a promise broken quietly, and the recording indicator staying
 * lit is exactly the thing that makes someone distrust the app afterwards.
 */
export const recordTurn = async (): Promise<Turn | null> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  if (typeof MediaRecorder === 'undefined') return null;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  return {
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        if (recorder.state === 'inactive') {
          release();
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          release();
          resolve(chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType }) : null);
        };
        recorder.stop();
      }),
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        /* already stopped */
      }
      release();
    },
  };
};

interface TranscriptionResponse {
  text?: unknown;
  language?: unknown;
}

/**
 * Send the audio for transcription.
 *
 * Returns null rather than throwing on any failure, because every caller does
 * the same thing with a failure — falls back to what the device heard — and an
 * exception crossing this boundary would only invite someone to handle it
 * differently somewhere else.
 */
export const transcribe = async (audio: Blob): Promise<Heard | null> => {
  const provider = stt();
  if (!configured(provider)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append('file', audio, 'turn.webm');
    form.append('model', provider.model);
    // Ask for the language back rather than pinning one. Section 1.1: it is
    // detected from the audio, never set by a person.
    form.append('response_format', 'verbose_json');

    const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${provider.key}` },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const body = (await response.json()) as TranscriptionResponse;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return null;

    return {
      text,
      language: typeof body.language === 'string' ? body.language : '',
      source: 'whisper',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
