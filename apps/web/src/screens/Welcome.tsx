import { useState, type Dispatch } from 'react';

import { BRAND, WELCOME } from '../lib/copy.js';
import type { Action } from '../lib/flow.js';

/**
 * Sign in. Deliberately minimal — master prompt section 4 keeps authentication
 * light for the demo. What matters is that a named operator is attached to the
 * incident record: a handover sheet with nobody's name on it is not a handover.
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
      <div className="spacer" />

      <div className="wordmark">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <h1>{BRAND.name}</h1>
        </div>
        <p className="tagline">{BRAND.tagline}</p>
      </div>

      <p className="mission">{BRAND.mission}</p>

      <div className="spacer" />

      <div className="field">
        <label htmlFor="operator">{WELCOME.nameLabel}</label>
        <input
          id="operator"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={WELCOME.namePlaceholder}
          autoComplete="name"
          autoFocus
        />
        <p className="note">{WELCOME.nameHint}</p>
      </div>

      <div className="actions">
        <button className="btn btn-primary btn-xl" type="submit" disabled={!trimmed}>
          {WELCOME.submit}
        </button>
        <p className="note">{BRAND.limits}</p>
      </div>
    </form>
  );
};
