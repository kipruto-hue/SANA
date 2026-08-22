import { useState, type Dispatch } from 'react';

import { ACKNOWLEDGEMENTS, CONSENT } from '../lib/copy.js';
import type { Action } from '../lib/flow.js';

/**
 * The consent gate. A hard gate before first use, not a dismissible notice:
 * SANA will not listen until every one of these is ticked.
 */
export const Consent = ({
  dispatch,
  operator,
}: {
  dispatch: Dispatch<Action>;
  operator: string;
}) => {
  const [checked, setChecked] = useState<boolean[]>(() => ACKNOWLEDGEMENTS.map(() => false));
  const remaining = checked.filter((value) => !value).length;
  const all = remaining === 0;

  const toggle = (index: number) =>
    setChecked((current) => current.map((value, i) => (i === index ? !value : value)));

  return (
    <div className="screen">
      <div>
        <p className="eyebrow">{CONSENT.eyebrow(operator)}</p>
        <h2 className="screen-title">{CONSENT.title}</h2>
        <p className="note" style={{ marginTop: 6 }}>
          {CONSENT.intro}
        </p>
      </div>

      <div className="screen-scroll">
        {ACKNOWLEDGEMENTS.map((text, index) => (
          <label className="ack" key={text} data-checked={checked[index] ? 'true' : 'false'}>
            <input
              type="checkbox"
              checked={checked[index] ?? false}
              onChange={() => toggle(index)}
            />
            <span>{text}</span>
          </label>
        ))}
      </div>

      <div className="actions">
        <button
          className="btn btn-primary btn-xl"
          type="button"
          disabled={!all}
          onClick={() => dispatch({ type: 'CONSENT_GIVEN' })}
        >
          {all ? CONSENT.submitReady : CONSENT.submitWaiting(remaining)}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => dispatch({ type: 'RESET' })}>
          {CONSENT.back}
        </button>
      </div>
    </div>
  );
};
