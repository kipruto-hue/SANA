import { useState, type Dispatch } from 'react';

import type { Action } from '../lib/flow.js';

/**
 * The consent gate. A hard gate before first use, not a dismissible notice:
 * SANA will not listen until every one of these is ticked.
 *
 * They are separate acknowledgements rather than one blanket checkbox on
 * purpose. The first two are the limits of what SANA is, and burying them
 * inside an "I agree to the terms" would defeat the point of stating them.
 */
const ACKNOWLEDGEMENTS = [
  'SANA cannot diagnose, prescribe or triage. It reads first-aid steps that people have written and reviewed.',
  'If this is life-threatening, I will call emergency services first. SANA is for the wait, not instead of the call.',
  'I am an adult, or staff on duty at this site.',
  'SANA may use my microphone to hear what I describe.',
  'This session will be recorded and a written transcript kept, so an incident record can be handed to a responder.',
] as const;

export const Consent = ({
  dispatch,
  operator,
}: {
  dispatch: Dispatch<Action>;
  operator: string;
}) => {
  const [checked, setChecked] = useState<boolean[]>(() => ACKNOWLEDGEMENTS.map(() => false));
  const all = checked.every(Boolean);

  const toggle = (index: number) =>
    setChecked((current) => current.map((value, i) => (i === index ? !value : value)));

  return (
    <div className="screen">
      <div>
        <p className="eyebrow">Before we start, {operator}</p>
        <h2 style={{ margin: '4px 0 0' }}>Five things to agree on</h2>
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
          {all ? 'I agree — continue' : `Tick all five to continue`}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => dispatch({ type: 'RESET' })}>
          Back
        </button>
      </div>
    </div>
  );
};
