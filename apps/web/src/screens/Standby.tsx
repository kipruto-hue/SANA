import { useState, type Dispatch } from 'react';

import { canDial, isConfigured, type SiteContext } from '../lib/context.js';
import type { Action, State } from '../lib/flow.js';
import { FULLY_REVIEWED } from '../lib/library.js';

/**
 * The resting state. One unmistakable action, and whatever the site has told
 * SANA about itself.
 *
 * Every field here is read from the context store. Nothing is baked in — see
 * decision 0003. Where a value is missing it says so in plain words rather
 * than showing a placeholder, because a placeholder emergency number is the
 * one thing in this interface that could get somebody hurt.
 */
const FIELDS: readonly { key: keyof SiteContext; label: string }[] = [
  { key: 'emergencyNumber', label: 'Emergency number' },
  { key: 'safetyOfficer', label: 'Safety officer on duty' },
  { key: 'kitLocation', label: 'First-aid kit' },
  { key: 'hospital', label: 'Nearest hospital' },
];

export const Standby = ({
  dispatch,
  state,
  context,
  onContextChange,
}: {
  dispatch: Dispatch<Action>;
  state: State;
  context: SiteContext;
  onContextChange: (context: SiteContext) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SiteContext>(context);

  if (editing) {
    return (
      <form
        className="screen"
        onSubmit={(event) => {
          event.preventDefault();
          onContextChange(draft);
          setEditing(false);
        }}
      >
        <div>
          <p className="eyebrow">Site setup</p>
          <h2 style={{ margin: '4px 0 0' }}>What should SANA know?</h2>
        </div>

        <div className="screen-scroll">
          <p className="note">
            SANA is deployed per site. These values are stored on this device and read at runtime —
            nothing is built into the app, so the same build works anywhere.
          </p>
          {(
            [
              ['site', 'Site name'],
              ['zone', 'Area or zone'],
              ['emergencyNumber', 'Local emergency number'],
              ['hospital', 'Nearest hospital'],
              ['safetyOfficer', 'Safety officer on duty'],
              ['kitLocation', 'Where the first-aid kit is'],
            ] as const
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                className="input"
                value={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                inputMode={key === 'emergencyNumber' ? 'tel' : 'text'}
              />
            </div>
          ))}
        </div>

        <div className="actions">
          <button className="btn btn-primary btn-xl" type="submit">
            Save
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setDraft(context);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="screen">
      <div className="live-top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <h1 style={{ fontSize: 26 }}>SANA</h1>
        </div>
        <span className="tag tag-neutral">{state.operator}</span>
      </div>

      <div className="spacer" />

      <div style={{ textAlign: 'center' }}>
        <p className="eyebrow">Ready</p>
        <p className="mission" style={{ margin: '6px auto 0' }}>
          If something happens, hold the button and tell me what you can see.
        </p>
      </div>

      <div className="actions">
        <button
          className="btn btn-primary btn-xl"
          type="button"
          style={{ minHeight: 82, fontSize: 19 }}
          onClick={() => dispatch({ type: 'START_EMERGENCY' })}
        >
          I need help
        </button>
      </div>

      <div className="spacer" />

      {!isConfigured(context) && (
        <div className="unconfigured">
          <strong>This site isn&rsquo;t set up yet.</strong> SANA doesn&rsquo;t know where it is or
          what number to dial, and it won&rsquo;t guess.{' '}
          <button
            className="btn btn-ghost"
            type="button"
            style={{ padding: 0, minHeight: 0 }}
            onClick={() => {
              setDraft(context);
              setEditing(true);
            }}
          >
            Set it up
          </button>
        </div>
      )}

      <dl className="site-card">
        <div className="site-row">
          <dt>Site</dt>
          <dd data-missing={context.site ? 'false' : 'true'}>
            {context.site || 'not configured'}
            {context.zone ? ` · ${context.zone}` : ''}
          </dd>
        </div>
        {FIELDS.map(({ key, label }) => (
          <div className="site-row" key={key}>
            <dt>{label}</dt>
            <dd data-missing={context[key] ? 'false' : 'true'}>
              {context[key] || 'not configured'}
            </dd>
          </div>
        ))}
      </dl>

      <div className="footer-actions">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setDraft(context);
            setEditing(true);
          }}
        >
          {canDial(context) ? 'Edit site details' : 'Set up this site'}
        </button>
        {!FULLY_REVIEWED && (
          <p className="review-flag">
            The three demo protocols are awaiting clinician sign-off. Until a named clinician has
            signed them, SANA does not describe them as reviewed.
          </p>
        )}
      </div>
    </div>
  );
};
