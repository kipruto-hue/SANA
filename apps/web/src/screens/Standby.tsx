import { useState, type Dispatch } from 'react';

import { BRAND, STANDBY, SITE_FIELDS, SITE_SUMMARY } from '../lib/copy.js';
import { canDial, isConfigured, type SiteContext } from '../lib/context.js';
import type { Action, State } from '../lib/flow.js';
import { FULLY_REVIEWED } from '../lib/library.js';

/**
 * The resting state. One unmistakable action, and whatever the site has told
 * SANA about itself.
 *
 * Every field is read from the context store. Nothing is baked in — decision
 * 0003. Where a value is missing it says so in plain words rather than showing
 * a placeholder, because a placeholder emergency number is the one thing in
 * this interface that could get somebody hurt.
 */
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

  const openEditor = () => {
    setDraft(context);
    setEditing(true);
  };

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
          <p className="eyebrow">{STANDBY.setupEyebrow}</p>
          <h2 className="screen-title">{STANDBY.setupTitle}</h2>
        </div>

        <div className="screen-scroll">
          <p className="note">{STANDBY.setupIntro}</p>
          {SITE_FIELDS.map(([key, label]) => (
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
            {STANDBY.setupSave}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setDraft(context);
              setEditing(false);
            }}
          >
            {STANDBY.setupCancel}
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
          <h1 style={{ fontSize: 24 }}>{BRAND.name}</h1>
        </div>
        <span className="tag tag-neutral">{state.operator}</span>
      </div>

      <div className="spacer" />

      <div style={{ textAlign: 'center' }}>
        <p className="eyebrow">{STANDBY.eyebrow}</p>
        <p className="mission" style={{ margin: '6px auto 0' }}>
          {STANDBY.restingLine}
        </p>
      </div>

      <div className="actions">
        <button
          className="btn btn-primary panic"
          type="button"
          onClick={() => dispatch({ type: 'START_EMERGENCY', context })}
        >
          {STANDBY.primary}
        </button>
      </div>

      <div className="spacer" />

      {!isConfigured(context) && (
        <div className="unconfigured">
          <strong>{STANDBY.notConfiguredTitle}</strong> {STANDBY.notConfiguredBody}{' '}
          <button className="btn btn-ghost inline-link" type="button" onClick={openEditor}>
            {STANDBY.notConfiguredAction}
          </button>
        </div>
      )}

      <dl className="site-card">
        <div className="site-row">
          <dt>Site</dt>
          <dd data-missing={context.site ? 'false' : 'true'}>
            {context.site || STANDBY.missing}
            {context.zone ? ` · ${context.zone}` : ''}
          </dd>
        </div>
        {SITE_SUMMARY.map(([key, label]) => (
          <div className="site-row" key={key}>
            <dt>{label}</dt>
            <dd data-missing={context[key] ? 'false' : 'true'}>
              {context[key] || STANDBY.missing}
            </dd>
          </div>
        ))}
      </dl>

      <div className="footer-actions">
        <button className="btn btn-secondary" type="button" onClick={openEditor}>
          {canDial(context) ? STANDBY.edit : STANDBY.setUp}
        </button>
        {!FULLY_REVIEWED && <p className="review-flag">{STANDBY.reviewPending}</p>}
      </div>
    </div>
  );
};
