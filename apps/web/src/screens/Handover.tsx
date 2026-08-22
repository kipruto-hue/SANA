import { useState, type Dispatch } from 'react';

import { HANDOVER, NOT_INCLUDED } from '../lib/copy.js';
import type { SiteContext } from '../lib/context.js';
import type { Action, State } from '../lib/flow.js';

/**
 * The handover sheet — the differentiator.
 *
 * Every line is derived from the append-only event log. Nothing is authored:
 * SANA does not summarise, interpret or grade what happened, because the
 * moment it does, it is assessing a patient. What it produces is a record of
 * what was said and done, with a time against each entry.
 */
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
  const [copied, setCopied] = useState(false);
  const observed = state.events.find((event) => event.kind === 'described');

  const actions: string[] = [];
  if (state.protocol) {
    // furthestStep, not stepIndex: the sheet reports how far the guidance got,
    // not where the screen happened to be when the session ended.
    const reached = state.furthestStep + 1;
    const total = state.protocol.steps.length;
    actions.push(
      reached >= total
        ? `Followed “${state.protocol.title}” — all ${total} steps read aloud.`
        : `Followed “${state.protocol.title}” — reached step ${reached} of ${total}.`,
    );
  }
  if (state.escalatedAt !== null) {
    actions.push(
      context.emergencyNumber
        ? `Called for help on ${context.emergencyNumber} at ${clock(state.escalatedAt)}.`
        : `Called for help at ${clock(state.escalatedAt)}.`,
    );
  }
  if (state.events.some((event) => event.kind === 'rejected')) {
    actions.push('An earlier suggestion was rejected by the operator.');
  }
  if (actions.length === 0) actions.push(HANDOVER.noActions);

  const asText = () =>
    [
      'SANA incident record',
      context.site ? `Site: ${context.site}${context.zone ? ` · ${context.zone}` : ''}` : null,
      `Operator: ${state.operator}`,
      state.startedAt ? `Started: ${new Date(state.startedAt).toLocaleString()}` : null,
      '',
      HANDOVER.whatHappened,
      observed?.detail ?? HANDOVER.nothingDescribed,
      '',
      HANDOVER.actions,
      ...actions.map((action) => `- ${action}`),
      '',
      HANDOVER.notIncluded,
      ...NOT_INCLUDED.map((item) => `- ${item}`),
      '',
      HANDOVER.timeline,
      ...state.events.map((event) => `${clock(event.at)}  ${event.detail}`),
    ]
      .filter((row) => row !== null)
      .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="screen">
      <div className="live-top">
        <div>
          <p className="eyebrow">{HANDOVER.eyebrow}</p>
          <h2 className="screen-title" style={{ fontSize: 23 }}>
            {HANDOVER.title}
          </h2>
        </div>
        {state.escalated && <span className="tag tag-accent">{HANDOVER.called}</span>}
      </div>

      <div className="screen-scroll">
        <div className="sheet-section">
          <h3>{HANDOVER.whereWho}</h3>
          <p>
            {context.site || 'Site not configured'}
            {context.zone ? ` · ${context.zone}` : ''} — {state.operator}
            {state.startedAt ? `, from ${clock(state.startedAt)}` : ''}
          </p>
        </div>

        <div className="sheet-section">
          <h3>{HANDOVER.whatHappened}</h3>
          <p>{observed?.detail ?? HANDOVER.nothingDescribed}</p>
        </div>

        {state.facts.length > 0 && (
          <div className="sheet-section">
            <h3>{HANDOVER.observed}</h3>
            <ul>
              {state.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="sheet-section">
          <h3>{HANDOVER.actions}</h3>
          <ul>
            {actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>

        <div className="sheet-section">
          <h3>{HANDOVER.notIncluded}</h3>
          <ul className="excluded">
            {NOT_INCLUDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="sheet-section">
          <h3>{HANDOVER.timeline}</h3>
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
          <p className="review-flag">{HANDOVER.provenance(state.protocol.title)}</p>
        )}
      </div>

      <div className="actions">
        <button className="btn btn-secondary btn-xl" type="button" onClick={copy}>
          {copied ? HANDOVER.copied : HANDOVER.copy}
        </button>
        <div className="step-nav">
          <button
            className="btn btn-ghost"
            type="button"
            style={{ flex: 1 }}
            onClick={() => dispatch({ type: 'BACK_TO_LIVE' })}
          >
            {HANDOVER.backToSession}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ flex: 1 }}
            onClick={() => dispatch({ type: 'RESET' })}
          >
            {HANDOVER.finish}
          </button>
        </div>
      </div>
    </div>
  );
};
