import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { loadContext, saveContext, type SiteContext } from './lib/context.js';
import { initialState, reducerWithHistory, type Screen } from './lib/flow.js';
import { persist } from './lib/log.js';
import { Consent } from './screens/Consent.js';
import { Handover } from './screens/Handover.js';
import { Live } from './screens/Live.js';
import { Standby } from './screens/Standby.js';
import { Welcome } from './screens/Welcome.js';

/** The order screens sit in, so a transition knows which way to travel. */
const ORDER: readonly Screen[] = ['welcome', 'consent', 'standby', 'live', 'handover'];

export const App = () => {
  const [state, dispatch] = useReducer(reducerWithHistory, initialState);
  const [context, setContext] = useState<SiteContext>(loadContext);

  const updateContext = useCallback((next: SiteContext) => {
    saveContext(next);
    setContext(next);
  }, []);

  // The log is written out after every change, so a stray refresh mid-incident
  // costs nothing. `persist` refuses any write that is not an append, which
  // means a bug upstream loses the write rather than rewriting the record.
  useEffect(() => {
    if (state.incidentId && state.events.length > 0) {
      persist({ incidentId: state.incidentId, events: state.events });
    }
  }, [state.incidentId, state.events]);

  const direction = useMemo(
    () =>
      ORDER.indexOf(state.screen) >= ORDER.indexOf(state.previousScreen) ? 'forward' : 'back',
    [state.screen, state.previousScreen],
  );

  return (
    <div className="app" data-screen={state.screen}>
      <div className="stage" key={state.screen} data-direction={direction}>
        {state.screen === 'welcome' && <Welcome dispatch={dispatch} />}
        {state.screen === 'consent' && <Consent dispatch={dispatch} operator={state.operator} />}
        {state.screen === 'standby' && (
          <Standby
            dispatch={dispatch}
            state={state}
            context={context}
            onContextChange={updateContext}
          />
        )}
        {state.screen === 'live' && <Live dispatch={dispatch} state={state} context={context} />}
        {state.screen === 'handover' && <Handover dispatch={dispatch} state={state} />}
      </div>
    </div>
  );
};
