import { useEffect, useRef, useState, type Dispatch } from 'react';

import { canDial, type SiteContext } from '../lib/context.js';
import { currentStep, PHASE_LABEL, type Action, type State } from '../lib/flow.js';
import {
  CONFIDENCE_THRESHOLD,
  line,
  matchProtocol,
} from '../lib/library.js';
import { listen, speak, speechSupported, stopSpeaking, type Listener } from '../lib/speech.js';

/**
 * The core screen. Everything the master prompt says must be reachable in an
 * emergency is on it at once: what SANA last said, the current step at reading
 * distance, and the dial control — which is never more than a thumb away and
 * is the only thing on screen wearing terracotta.
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
  const step = currentStep(state);
  const dialable = canDial(context);

  // Acknowledge immediately, so there is never dead silence at the start.
  useEffect(() => {
    speak(line('acknowledge'));
    return () => stopSpeaking();
  }, []);

  // Read each step aloud as it arrives. Locked library wording only.
  useEffect(() => {
    if (state.phase === 'guiding' && step) speak(step.text);
  }, [state.phase, step]);

  useEffect(() => {
    if (state.phase === 'confirming' && state.match) speak(state.match.protocol.confirm_prompt);
    if (state.phase === 'unmatched') speak(line('unmatched'));
  }, [state.phase, state.match]);

  const stopListening = () => {
    listener.current?.stop();
    listener.current = null;
    setListening(false);
  };

  const submit = (text: string) => {
    const said = text.trim();
    if (!said) return;
    stopListening();
    dispatch({ type: 'TRANSCRIPT', text: said });
    dispatch({ type: 'MATCHING' });
    speak(line('thinking'));

    // A beat of thinking time, so the interface does not snap through the
    // matching state faster than a frightened person can follow it.
    window.setTimeout(() => {
      const match = matchProtocol(said);
      if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
        dispatch({ type: 'MATCHED', match });
      } else {
        dispatch({ type: 'UNMATCHED' });
      }
    }, 900);
  };

  const startListening = () => {
    setError('');
    stopSpeaking();
    const active = listen(
      (text, final) => {
        dispatch({ type: 'TRANSCRIPT', text });
        if (final) submit(text);
      },
      (message) => {
        setError(message);
        setListening(false);
      },
    );
    if (!active) {
      setError('This browser cannot listen. Type what you can see instead.');
      return;
    }
    listener.current = active;
    setListening(true);
  };

  return (
    <div className="screen">
      <div className="live-top">
        <span className="tag tag-accent-2">{PHASE_LABEL[state.phase]}</span>
        <span className="rec">
          <i aria-hidden="true" />
          Recording this incident
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
                onClick={() => (listening ? (stopListening(), submit(state.transcript)) : startListening())}
                aria-label={listening ? 'Stop listening' : 'Start listening'}
              >
                {listening ? 'Listening…' : 'Tap to talk'}
              </button>
            </div>
            <p className="said">{line('acknowledge')}</p>
            <p className="captions">{state.transcript || (listening ? 'Go ahead…' : '')}</p>

            {(!speechSupported() || error) && (
              <form
                className="field"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(typed);
                  setTyped('');
                }}
              >
                {error && <p className="note">{error}</p>}
                <label htmlFor="typed">Or type what you can see</label>
                <input
                  id="typed"
                  className="input"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder="She collapsed and won't wake up"
                />
                <button className="btn btn-secondary" type="submit" disabled={!typed.trim()}>
                  Tell SANA
                </button>
              </form>
            )}
          </>
        )}

        {state.phase === 'matching' && (
          <div className="orb-wrap">
            <div className="orb" data-active="true" aria-live="polite">
              Thinking…
            </div>
          </div>
        )}

        {state.phase === 'confirming' && state.match && (
          <div className="confirm">
            <span className="step-n">Confirm before I guide</span>
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
                Continue
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  speak(line('not_right'));
                  dispatch({ type: 'HUMAN_REJECTED' });
                }}
              >
                Not right?
              </button>
            </div>
          </div>
        )}

        {state.phase === 'unmatched' && (
          <div className="confirm" style={{ borderColor: 'var(--color-accent-400)', background: 'var(--color-accent-100)' }}>
            <span className="step-n" style={{ color: 'var(--color-accent-800)' }}>
              I can&rsquo;t match this
            </span>
            <p>{line('unmatched')}</p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => dispatch({ type: 'HUMAN_REJECTED' })}
            >
              Try describing it again
            </button>
          </div>
        )}

        {state.phase === 'guiding' && step && state.protocol && (
          <div className="step">
            <span className="step-n">
              Step {step.n} of {state.protocol.steps.length} · {state.protocol.title}
            </span>
            <p className="step-text">{step.text}</p>
            <div className="step-nav">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => dispatch({ type: 'PREV_STEP' })}
                disabled={state.stepIndex === 0}
              >
                Back
              </button>
              <button
                className="btn btn-secondary btn-xl"
                type="button"
                style={{ flex: 1 }}
                onClick={() => dispatch({ type: 'NEXT_STEP' })}
              >
                {state.stepIndex === state.protocol.steps.length - 1 ? 'Done' : 'Next step'}
              </button>
              <button
                className="btn btn-icon btn-secondary"
                type="button"
                aria-label="Read this step again"
                onClick={() => speak(step.text)}
              >
                ↻
              </button>
            </div>
          </div>
        )}

        {state.phase === 'resolved' && (
          <div className="confirm">
            <span className="step-n">That&rsquo;s everything I have</span>
            <p>{line('protocol_complete')}</p>
            <button
              className="btn btn-secondary btn-xl"
              type="button"
              onClick={() => dispatch({ type: 'VIEW_HANDOVER' })}
            >
              Open the handover sheet
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
              speak(line('escalation_confirmed'));
              dispatch({ type: 'HUMAN_TAPPED_CALL' });
            }}
          >
            Call for help · {context.emergencyNumber}
          </a>
        ) : (
          <button className="call" type="button" data-disabled="true" disabled>
            No emergency number set for this site
          </button>
        )}
        {!dialable && <p className="note">{line('no_emergency_number')}</p>}
        {state.escalated && <p className="note">Called at {new Date().toLocaleTimeString()}. The handover sheet is ready to read out.</p>}
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => dispatch({ type: 'RESOLVE' })}
        >
          End session and open handover
        </button>
      </div>
    </div>
  );
};
