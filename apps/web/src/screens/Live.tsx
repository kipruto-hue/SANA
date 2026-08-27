import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';

import { LIVE } from '../lib/copy.js';
import { canDial, type SiteContext } from '../lib/context.js';
import { currentStep, PHASE_LABEL, type Action, type State } from '../lib/flow.js';
import { CONFIDENCE_THRESHOLD, line, lineAudio } from '../lib/library.js';
import { selectProtocol } from '../lib/nlu.js';
import { listen, speechSupported, type Listener } from '../lib/speech.js';
import { recordTurn, transcribe, whisperConfigured, type Heard, type Turn } from '../lib/stt.js';
import { confirmAudio, play, stopVoice } from '../lib/voice.js';

/** Held longer than this and releasing ends the turn; a quick tap latches on. */
const HOLD_MS = 500;

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * The core screen. Everything the master prompt says must be reachable in an
 * emergency is on it at once: what SANA last said, the current step at reading
 * distance, and the dial control — never more than a thumb away, and the only
 * thing on screen wearing terracotta.
 */
export const Live = ({
  dispatch,
  state,
  context,
}: {
  dispatch: Dispatch<Action>;
  state: State;
  context: SiteContext;
}) => {
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const listener = useRef<Listener | null>(null);
  const turn = useRef<Turn | null>(null);
  const heldFrom = useRef<number>(0);
  const latest = useRef<string>('');
  const step = currentStep(state);
  const dialable = canDial(context);

  /**
   * Play a locked line, and record what actually happened.
   *
   * Everything SANA says goes through here, which is what makes `ref`
   * meaningful: it names where in the frozen library the line came from, so
   * the log shows provenance without copying medical text into a second place
   * that could drift from the reviewed one.
   *
   * A missing file is recorded as silence rather than swallowed. Until the
   * Fish Audio voice is generated most lines will be silent, and a record that
   * quietly implied they were spoken would be worse than one that says so.
   */
  const say = useCallback(
    async (audioPath: string, ref: string) => {
      const result = await play(audioPath);
      dispatch({ type: 'SPOKE', ref, outcome: result === 'played' ? 'played' : 'silent' });
    },
    [dispatch],
  );

  // Acknowledge the moment the session opens, so there is never dead silence.
  useEffect(() => {
    void say(lineAudio('acknowledge'), 'system line “acknowledge”');
    return () => {
      stopVoice();
      listener.current?.stop();
      turn.current?.cancel();
    };
    // Once, when the session opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read each step aloud as it arrives. Locked library wording only.
  useEffect(() => {
    if (state.phase === 'guiding' && step && state.protocol) {
      void say(step.audio, `${state.protocol.id} step ${step.n}`);
    }
  }, [state.phase, step, state.protocol, say]);

  useEffect(() => {
    if (state.phase === 'confirming' && state.match) {
      void say(confirmAudio(state.match.protocol.id), `${state.match.protocol.id} confirm prompt`);
    }
    if (state.phase === 'unmatched') void say(lineAudio('unmatched'), 'system line “unmatched”');
  }, [state.phase, state.match, say]);

  const stopListening = useCallback(() => {
    listener.current?.stop();
    listener.current = null;
    setListening(false);
  }, []);

  const submit = useCallback(
    async (text: string) => {
      const onDevice = text.trim();
      const recorder = turn.current;
      turn.current = null;
      if (!onDevice && !recorder) return;
      stopListening();

      // What the device heard is the starting point; Whisper's transcript
      // replaces it when there is one. The captions have already shown the
      // device's version, so this only ever corrects what is on screen —
      // it never leaves the screen blank while waiting.
      let heard: Heard = { text: onDevice, language: '', source: 'on-device' };
      if (recorder) {
        const audio = await recorder.stop();
        const whisper = audio ? await transcribe(audio) : null;
        if (whisper) heard = whisper;
      }

      const said = heard.text.trim();
      if (!said) return;
      dispatch({ type: 'TRANSCRIPT', text: said });
      dispatch({ type: 'MATCHING', language: heard.language, source: heard.source });
      void say(lineAudio('thinking'), 'system line “thinking”');

      // A beat of thinking time, so the interface does not snap through
      // matching faster than a frightened person can follow. The selector call
      // runs alongside it rather than after it, so a fast answer still waits
      // and a slow one does not add to the wait.
      const beat = new Promise((resolve) => window.setTimeout(resolve, 900));
      void Promise.all([selectProtocol(said), beat]).then(([result]) => {
        if (result.fallbackReason) {
          // Recorded, not hidden. A record that did not say the model was
          // unreachable would imply it had been consulted.
          dispatch({ type: 'SELECTOR_FALLBACK', reason: result.fallbackReason });
        }
        const { match } = result;
        if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
          dispatch({ type: 'MATCHED', match });
        } else {
          dispatch({ type: 'UNMATCHED' });
        }
      });
    },
    [dispatch, say, stopListening],
  );

  const startListening = useCallback(() => {
    setError('');
    stopVoice();
    latest.current = '';

    // Recording runs alongside the browser's recognition, not instead of it:
    // one gives captions immediately, the other gives the transcript the
    // record keeps. Started without awaiting so the microphone opens while
    // the person is already talking.
    if (whisperConfigured()) {
      void recordTurn().then((started) => {
        turn.current = started;
      });
    }
    const active = listen(
      (text, final) => {
        latest.current = text;
        dispatch({ type: 'TRANSCRIPT', text });
        if (final) void submit(text);
      },
      (message) => {
        setError(message);
        setListening(false);
      },
    );
    if (!active && !whisperConfigured()) {
      // No ears at all. The typing fallback is the backup channel by design,
      // not an afterthought, so this is a message rather than a dead end.
      setError(LIVE.micUnsupported);
      return;
    }
    listener.current = active;
    setListening(true);
  }, [dispatch, submit]);

  // Hold to talk, or tap to latch. Both work, because a person holding a phone
  // one-handed over a casualty may not manage a steady press.
  const onPress = () => {
    heldFrom.current = Date.now();
    if (!listening) startListening();
  };

  const onRelease = () => {
    const held = Date.now() - heldFrom.current;
    if (!listening) return;
    if (held >= HOLD_MS) void submit(latest.current || state.transcript);
  };

  const onTap = () => {
    if (Date.now() - heldFrom.current >= HOLD_MS) return; // the hold already handled it
    if (listening) void submit(latest.current || state.transcript);
  };

  const total = state.protocol?.steps.length ?? 0;

  return (
    <div className="screen">
      <div className="live-top">
        <span className="tag tag-accent-2">{PHASE_LABEL[state.phase]}</span>
        <span className="rec">
          <i aria-hidden="true" />
          {LIVE.recording}
        </span>
      </div>

      <div className="screen-scroll">
        {state.phase === 'listening' && (
          <>
            <div className="orb-wrap">
              <button
                className="orb"
                type="button"
                data-active={listening ? 'true' : 'false'}
                onPointerDown={onPress}
                onPointerUp={onRelease}
                onPointerLeave={onRelease}
                onClick={onTap}
                aria-label={listening ? 'Stop listening and send' : 'Hold to talk'}
              >
                {listening ? LIVE.listening : LIVE.tapToTalk}
              </button>
            </div>
            <p className="said">{line('acknowledge')}</p>
            <p className="captions">{state.transcript || (listening ? LIVE.goAhead : '')}</p>

            {(!speechSupported() || error) && (
              <form
                className="field"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(typed);
                  setTyped('');
                }}
              >
                {error && <p className="note">{error}</p>}
                <label htmlFor="typed">{LIVE.typeLabel}</label>
                <input
                  id="typed"
                  className="input"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={LIVE.typePlaceholder}
                />
                <button className="btn btn-secondary" type="submit" disabled={!typed.trim()}>
                  {LIVE.typeSubmit}
                </button>
              </form>
            )}
          </>
        )}

        {state.phase === 'matching' && (
          <div className="orb-wrap">
            <div className="orb" data-active="true" aria-live="polite">
              {LIVE.thinking}
            </div>
          </div>
        )}

        {state.phase === 'confirming' && state.match && (
          <div className="confirm">
            <span className="step-n">{LIVE.confirmKicker}</span>
            <p>{state.match.protocol.confirm_prompt}</p>
            {state.facts.length > 0 && (
              <div className="facts">
                {state.facts.slice(0, 4).map((fact) => (
                  <span className="tag tag-neutral" key={fact}>
                    {fact}
                  </span>
                ))}
              </div>
            )}
            <div className="row">
              <button
                className="btn btn-secondary btn-xl"
                type="button"
                style={{ flex: 1 }}
                onClick={() => dispatch({ type: 'HUMAN_CONFIRMED' })}
              >
                {LIVE.confirmYes}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  void say(lineAudio('not_right'), 'system line “not_right”');
                  dispatch({ type: 'HUMAN_REJECTED' });
                }}
              >
                {LIVE.confirmNo}
              </button>
            </div>
          </div>
        )}

        {state.phase === 'unmatched' && (
          <div className="confirm is-uncertain">
            <span className="step-n">{LIVE.unmatchedKicker}</span>
            <p>{line('unmatched')}</p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => dispatch({ type: 'HUMAN_REJECTED' })}
            >
              {LIVE.unmatchedRetry}
            </button>
          </div>
        )}

        {state.phase === 'guiding' && step && state.protocol && (
          <div className="step">
            <span className="step-n">{LIVE.stepOf(step.n, total, state.protocol.title)}</span>
            <div className="pips" aria-hidden="true">
              {state.protocol.steps.map((s) => (
                <span key={s.n} data-done={s.n <= step.n ? 'true' : 'false'} />
              ))}
            </div>
            <p className="step-text">{step.text}</p>
            <div className="step-nav">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => dispatch({ type: 'PREV_STEP' })}
                disabled={state.stepIndex === 0}
              >
                {LIVE.back}
              </button>
              <button
                className="btn btn-secondary btn-xl"
                type="button"
                style={{ flex: 1 }}
                onClick={() => dispatch({ type: 'NEXT_STEP' })}
              >
                {state.stepIndex === total - 1 ? LIVE.lastStep : LIVE.next}
              </button>
              <button
                className="btn btn-icon btn-secondary"
                type="button"
                aria-label={LIVE.repeat}
                title={LIVE.repeat}
                onClick={() =>
                  void say(step.audio, `${state.protocol?.id ?? 'protocol'} step ${step.n} (repeat)`)
                }
              >
                ↻
              </button>
            </div>
          </div>
        )}

        {state.phase === 'resolved' && (
          <div className="confirm">
            <span className="step-n">{LIVE.completeKicker}</span>
            <p>{line('protocol_complete')}</p>
            <button
              className="btn btn-secondary btn-xl"
              type="button"
              onClick={() => dispatch({ type: 'VIEW_HANDOVER' })}
            >
              {LIVE.openHandover}
            </button>
          </div>
        )}
      </div>

      <div className="footer-actions">
        {dialable ? (
          <a
            className="call"
            href={`tel:${context.emergencyNumber.replace(/\s/g, '')}`}
            onClick={() => {
              void say(lineAudio('escalation_confirmed'), 'system line “escalation_confirmed”');
              dispatch({ type: 'HUMAN_TAPPED_CALL', number: context.emergencyNumber });
            }}
          >
            {LIVE.call(context.emergencyNumber)}
          </a>
        ) : (
          <button className="call" type="button" data-disabled="true" disabled>
            {LIVE.callUnavailable}
          </button>
        )}
        {!dialable && <p className="note">{line('no_emergency_number')}</p>}
        {state.escalatedAt !== null && (
          <p className="note">{LIVE.calledAt(clock(state.escalatedAt))}</p>
        )}
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => dispatch({ type: 'RESOLVE' })}
        >
          {LIVE.endSession}
        </button>
      </div>
    </div>
  );
};
