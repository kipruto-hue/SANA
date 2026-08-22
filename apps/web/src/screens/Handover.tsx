import type { Dispatch } from 'react';

import type { SiteContext } from '../lib/context.js';
import type { Action, State } from '../lib/flow.js';

/**
 * The handover sheet — the differentiator.
 *
 * Every line of it is derived from the append-only event log. Nothing here is
 * authored: SANA does not summarise, interpret or grade what happened, because
 * the moment it does, it is assessing a patient. What it produces is a record
 * of what was said and done, with the time against each entry.
 *
 * The "Not included" section is the honest part, and it is deliberately on the
 * sheet rather than in a footnote: it tells a paramedic exactly what this
 * document is not, so nobody mistakes it for triage.
 */
const NOT_INCLUDED = [
  'No diagnosis. SANA never names a cause.',
  'No assessment of severity or priority.',
  'No vital signs beyond what the operator said aloud.',
  'No medication given or advised.',
] as const;

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const Handover = ({
  dispatch,
  state,
  context,
}: {
  dispatch: Dispatch<Action>;
  state: State;
  context: SiteContext;
}) => {
  const started = state.startedAt;
  const observed = state.events.find((event) => event.kind === 'described');
  const stepsRead = state.events.filter((event) => event.kind === 'step').length;

  const actions: string[] = [];
  if (state.protocol) {
    actions.push(
      `Followed "${state.protocol.title}" — ${stepsRead + 1} of ${state.protocol.steps.length} steps read aloud.`,
    );
  }
  if (state.escalated) {
    actions.push(
      context.emergencyNumber
        ? `Called for help on ${context.emergencyNumber}.`
        : 'Called for help.',
    );
  }
  if (state.events.some((event) => event.kind === 'rejected')) {
    actions.push('An earlier suggestion was rejected by the operator.');
  }
  if (actions.length === 0) actions.push('No guidance was given during this session.');

  const copy = () => {
    const text = [
      `SANA incident record`,
      context.site ? `Site: ${context.site}${context.zone ? ` · ${context.zone}` : ''}` : null,
      `Operator: ${state.operator}`,
      started ? `Started: ${new Date(started).toLocaleString()}` : null,
      '',
      'What happened',
      observed?.detail ?? 'Nothing was described.',
      '',
      'Actions taken',
      ...actions.map((action) => `- ${action}`),
      '',
      'Not included',
      ...NOT_INCLUDED.map((item) => `- ${item}`),
      '',
      'Timeline',
      ...state.events.map((event) => `${clock(event.at)}  ${event.detail}`),
    ]
      .filter((row) => row !== null)
      .join('\n');
    void navigator.clipboard?.writeText(text);
  };

  return (
    <div className="screen">
      <div className="live-top">
        <div>
          <p className="eyebrow">Handover sheet</p>
          <h2 style={{ margin: '2px 0 0', fontSize: 24 }}>Read this to the responder</h2>
        </div>
        {state.escalated && <span className="tag tag-accent">Help called</span>}
      </div>

      <div className="screen-scroll">
        <div className="sheet-section">
          <h3>Where and who</h3>
          <p>
            {context.site || 'Site not configured'}
            {context.zone ? ` · ${context.zone}` : ''} — {state.operator}
            {started ? `, from ${clock(started)}` : ''}
          </p>
        </div>

        <div className="sheet-section">
          <h3>What happened</h3>
          <p>{observed?.detail ?? 'Nothing was described in this session.'}</p>
        </div>

        {state.facts.length > 0 && (
          <div className="sheet-section">
            <h3>Observed — as reported by the operator</h3>
            <ul>
              {state.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="sheet-section">
          <h3>Actions taken</h3>
          <ul>
            {actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>

        <div className="sheet-section">
          <h3>Not included</h3>
          <ul className="excluded">
            {NOT_INCLUDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="sheet-section">
          <h3>Timeline</h3>
          <div className="timeline">
            {state.events.map((event) => (
              <div className="tl-row" key={`${event.at}-${event.kind}`}>
                <time>{clock(event.at)}</time>
                <span>{event.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {state.protocol && (
          <p className="review-flag">
            Steps read from &ldquo;{state.protocol.title}&rdquo;, sourced from published first-aid
            guidance and awaiting clinician sign-off. SANA did not write them.
          </p>
        )}
      </div>

      <div className="actions">
        <button className="btn btn-secondary btn-xl" type="button" onClick={copy}>
          Copy for the record
        </button>
        <div className="step-nav">
          <button
            className="btn btn-ghost"
            type="button"
            style={{ flex: 1 }}
            onClick={() => dispatch({ type: 'BACK_TO_LIVE' })}
          >
            Back to session
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ flex: 1 }}
            onClick={() => dispatch({ type: 'RESET' })}
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
};
