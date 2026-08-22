import { useState, type Dispatch } from 'react';

import type { Action } from '../lib/flow.js';

/**
 * Sign in. Deliberately minimal — master prompt section 4 keeps authentication
 * light for the demo. What matters is that a named operator is attached to the
 * incident record, because a handover sheet with no one's name on it is not a
 * handover.
 */
export const Welcome = ({ dispatch }: { dispatch: Dispatch<Action> }) => {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  return (
    <form
      className="screen"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) dispatch({ type: 'SIGN_IN', operator: trimmed });
      }}
    >
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <h1>SANA</h1>
      </div>

      <div className="spacer" />

      <p className="eyebrow">For the minutes before help arrives</p>
      <p className="mission">
        Tell me what you can see. I&rsquo;ll find the right first-aid steps, check them with you,
        and read them out one at a time.
      </p>

      <div className="spacer" />

      <div className="field">
        <label htmlFor="operator">Your name</label>
        <input
          id="operator"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="So the handover sheet knows who was here"
          autoComplete="name"
          autoFocus
        />
      </div>

      <div className="actions">
        <button className="btn btn-primary btn-xl" type="submit" disabled={!trimmed}>
          Continue
        </button>
        <p className="note">
          SANA does not diagnose, prescribe or triage. In a life-threatening emergency, call your
          emergency services first.
        </p>
      </div>
    </form>
  );
};
