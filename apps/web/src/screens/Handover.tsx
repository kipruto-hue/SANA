import { useMemo, useState, type Dispatch } from 'react';

import { HANDOVER, NOT_INCLUDED } from '../lib/copy.js';
import {
  actionLines,
  clock,
  deriveHandover,
  downloadRecord,
  toText,
  type RecordLabels,
} from '../lib/handover.js';
import type { Action, State } from '../lib/flow.js';

/**
 * The handover sheet — the differentiator.
 *
 * This component renders `deriveHandover(state.events)` and composes nothing
 * of its own. That division is the safety property, not a tidiness one: the
 * record is a view of the append-only log, so a change to this file can change
 * how the record *looks* and can never change what it *says*. Every sentence
 * traces to an event the system wrote at the moment it happened.
 *
 * Note what it does not read: the live site context. Where SANA was and what
 * number it had are taken from the `started` and `escalated` events, so
 * editing the site tomorrow cannot rewrite yesterday's incident.
 */
const LABELS: RecordLabels = {
  whatHappened: HANDOVER.whatHappened,
  nothingDescribed: HANDOVER.nothingDescribed,
  actions: HANDOVER.actions,
  notIncluded: HANDOVER.notIncluded,
  timeline: HANDOVER.timeline,
  noActions: HANDOVER.noActions,
  notIncludedItems: NOT_INCLUDED,
};

export const Handover = ({
  dispatch,
  state,
}: {
  dispatch: Dispatch<Action>;
  state: State;
}) => {
  const [copied, setCopied] = useState(false);
  const record = useMemo(() => deriveHandover(state.events), [state.events]);
  const actions = actionLines(record, HANDOVER.noActions);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText(record, LABELS));
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
        {record.escalatedAt !== null && <span className="tag tag-accent">{HANDOVER.called}</span>}
      </div>

      <div className="screen-scroll">
        <div className="sheet-section">
          <h3>{HANDOVER.whereWho}</h3>
          <p>
            {record.site || 'Site not configured'}
            {record.zone ? ` · ${record.zone}` : ''}
            {record.operator ? ` — ${record.operator}` : ''}
            {record.startedAt ? `, from ${clock(record.startedAt)}` : ''}
          </p>
        </div>

        <div className="sheet-section">
          <h3>{HANDOVER.whatHappened}</h3>
          <p>{record.whatHappened || HANDOVER.nothingDescribed}</p>
        </div>

        {record.observed.length > 0 && (
          <div className="sheet-section">
            <h3>{HANDOVER.observed}</h3>
            <ul>
              {record.observed.map((fact) => (
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
            {record.timeline.map((event) => (
              <div className="tl-row" key={event.seq}>
                <time>{clock(event.at)}</time>
                <span>{event.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {record.selector && <p className="note">{HANDOVER.chosenBy(record.selector)}</p>}
        {record.protocolTitle && (
          <p className="review-flag">{HANDOVER.provenance(record.protocolTitle)}</p>
        )}
      </div>

      <div className="actions">
        <div className="step-nav">
          <button
            className="btn btn-secondary btn-xl"
            type="button"
            style={{ flex: 1 }}
            onClick={copy}
          >
            {copied ? HANDOVER.copied : HANDOVER.copy}
          </button>
          <button
            className="btn btn-secondary btn-xl"
            type="button"
            style={{ flex: 1 }}
            onClick={() => downloadRecord(record, LABELS)}
          >
            {HANDOVER.save}
          </button>
        </div>
        <p className="note">{HANDOVER.saveHint}</p>
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
