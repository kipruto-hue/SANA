import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';

import { LIVE } from '../lib/copy.js';
import { canDial, type SiteContext } from '../lib/context.js';
import { currentStep, PHASE_LABEL, type Action, type State } from '../lib/flow.js';
import { CONFIDENCE_THRESHOLD, line, lineAudio, responseAudio, responseLine } from '../lib/library.js';
import { lastReplyIntent } from '../lib/handover.js';
import { classifyIntent, selectProtocol } from '../lib/nlu.js';
import { listen, speechSupported, type Listener } from '../lib/speech.js';
import { recordTurn, transcribe, whisperConfigured, type Heard, type Turn } from '../lib/stt.js';
import { confirmAudio, play, responsesAvailable, stopVoice } from '../lib/voice.js';

/** Held longer than this and releasing ends the turn; a quick tap latches on. */
const HOLD_MS = 500;

/**
 * How long SANA listens for a reply before giving up and going quiet.
 *
 * Bounded on purpose. A microphone that stays open indefinitely between steps
 * is both a battery problem and a trust problem, and going quiet costs nothing
 * — the buttons never stopped working.
 */
const REPLY_WINDOW_MS = 12_000;

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
  /**
   * Whether the conversational loop is on.
   *
   * Decided by whether the locked reply lines have actually been recorded, not
   * by a setting. Until Fish Audio has rendered them SANA stays the stepper it
   * already is, which is the version that is known to work.
   */
  const [conversational, setConversational] = useState(false);

  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const listener = useRef<Listener | null>(null);
  const turn = useRef<Turn | null>(null);
  const heldFrom = useRef<number>(0);
  const latest = useRef<string>('');
  const step = currentStep(state);
  const dialable = canDial(context);

  /**
   * The locked line SANA last answered with.
   *
   * Derived from the log, never held in component state — the log already
   * records what was said, and a second copy is a second thing that can
   * disagree with it. On screen as well as spoken, always: the screen is the
   * channel that works when the audio has not been recorded, when the room is
   * loud, and when the person cannot hear. Same locked wording, never a
   * variant.
   */
  const reply = responseLine(lastReplyIntent(state.events));

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

  useEffect(() => {
    void responsesAvailable().then(setConversational);
  }, []);

  // Read each step aloud as it arrives, then listen for a reply to it. Locked
  // library wording only, in both directions.
  useEffect(() => {
    if (state.phase !== 'guiding' || !step || !state.protocol) return;
    let cancelled = false;
    void say(step.audio, `${state.protocol.id} step ${step.n}`).then(() => {
      if (!cancelled && conversational) dispatch({ type: 'AWAIT_RESPONSE' });
    });
    return () => {
      cancelled = true;
    };
  }, [state.phase, step, state.protocol, say, conversational, dispatch]);

  /**
   * The listening loop — the conversational upgrade, and the whole of it.
   *
   * SANA hears a reply, the model classifies it into one of six locked
   * intents, and SANA answers with the locked line for that intent. Only
   * `ready` advances, and it advances by dispatching the same NEXT_STEP the
   * Next button dispatches — there is no second path through the steps.
   *
   * Everything here is additive. The buttons work throughout, a silent window
   * simply ends the listen, and a classifier that is absent or unsure yields
   * `unclear`, which holds the guidance exactly where it is. Nothing in this
   * effect can reach `guiding`; it only ever runs inside it.
   */
  useEffect(() => {
    if (!state.awaitingResponse) return;

    let cancelled = false;
    let recogniser: Listener | null = null;
    let recorder: Turn | null = null;

    const finish = async (deviceText: string) => {
      if (cancelled) return;
      recogniser?.stop();

      let heard: Heard = { text: deviceText, language: '', source: 'on-device' };
      if (recorder) {
        const audio = await recorder.stop();
        recorder = null;
        const whisper = audio ? await transcribe(audio) : null;
        if (whisper) heard = whisper;
      }
      if (cancelled) return;

      const said = heard.text.trim();
      // Silence is an answer too, and the answer is to stop listening.
      if (!said) {
        dispatch({ type: 'CANCEL_AWAIT' });
        return;
      }

      const { intent, selector } = await classifyIntent(said);
      if (cancelled) return;
      dispatch({
        type: 'HEARD_RESPONSE',
        transcript: said,
        language: heard.language,
        intent,
        selector,
      });

        const outcome = await play(responseAudio(intent));
      if (cancelled) return;
      dispatch({
        type: 'SPOKE_RESPONSE',
        intent,
        outcome: outcome === 'played' ? 'played' : 'silent',
      });

      if (intent === 'repeat' && step && state.protocol) {
        await say(step.audio, `${state.protocol.id} step ${step.n} (repeat)`);
      }
      // `ready` and `stop` have already moved the flow on, and the step effect
      // picks it up from there. The rest hold on this step and keep listening,
      // because someone who is frightened or reporting a change is still
      // talking to us.
      if (!cancelled && intent !== 'ready' && intent !== 'stop') {
        dispatch({ type: 'AWAIT_RESPONSE' });
      }
    };

    recogniser = listen(
      (text, final) => {
        if (final) void finish(text);
      },
      () => {
        // A recognition error between steps is not worth interrupting for.
        // The buttons are right there.
        dispatch({ type: 'CANCEL_AWAIT' });
      },
    );
    if (whisperConfigured()) {
      void recordTurn().then((started) => {
        if (cancelled) started?.cancel();
        else recorder = started;
      });
    }

    const window_ = window.setTimeout(() => void finish(''), REPLY_WINDOW_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(window_);
      recogniser?.stop();
      recorder?.cancel();
    };
    // `step` and `state.protocol` are read inside, but re-running this effect
    // on a step change is exactly wrong: the change already cancelled the
    // listen, and restarting it here would race the step audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.awaitingResponse, dispatch]);

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
            {reply && <p className="said">{reply}</p>}
            {state.awaitingResponse && (
              <p className="captions" aria-live="polite">
                {LIVE.awaitingReply}
              </p>
            )}
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
