import type { SiteContext } from './context.js';
import type { Match, Protocol } from './library.js';
import {
  append,
  newIncidentId,
  type EventData,
  type EventKind,
  type LoggedEvent,
} from './log.js';

/**
 * The flow SANA is allowed to take, as data.
 *
 * The safety rails from master prompt section 3 live here rather than in the
 * screens, because a rule enforced by a component is a rule one refactor away
 * from disappearing. Two of them are structural:
 *
 *   - GUIDING is reachable only by HUMAN_CONFIRMED. No timer, no confidence
 *     score, and no model output can produce it. The human owns the match.
 *   - escalation is recorded, never performed. Nothing here dials anything;
 *     the screen renders a tel: link and the human taps it.
 */

export type Screen = 'welcome' | 'consent' | 'standby' | 'live' | 'handover';

export type Phase =
  | 'listening'
  | 'matching'
  | 'confirming'
  | 'guiding'
  | 'unmatched'
  | 'resolved';

/**
 * The log's event type lives in `log.js`, which owns the append-only rules.
 * Re-exported under the old name so nothing downstream has to care where the
 * guarantees are enforced.
 */
export type IncidentEvent = LoggedEvent;

export interface State {
  readonly screen: Screen;
  /** Identifies this incident's log, so a resumed record is never merged. */
  readonly incidentId: string;
  /** The screen we came from, so a transition knows which way to travel. */
  readonly previousScreen: Screen;
  readonly phase: Phase;
  readonly operator: string;
  readonly consented: boolean;
  readonly transcript: string;
  readonly facts: readonly string[];
  readonly match: Match | null;
  readonly protocol: Protocol | null;
  readonly stepIndex: number;
  /**
   * The furthest step actually reached. Distinct from stepIndex, which moves
   * back when the operator taps Back -- the handover sheet must report how far
   * the guidance actually got, not where the screen happens to be sitting.
   */
  readonly furthestStep: number;
  /** When the human tapped the dial control, so the record can state it. */
  readonly escalatedAt: number | null;
  readonly escalated: boolean;
  readonly startedAt: number | null;
  readonly events: readonly LoggedEvent[];
}

export const initialState: State = {
  screen: 'welcome',
  incidentId: '',
  previousScreen: 'welcome',
  phase: 'listening',
  operator: '',
  consented: false,
  transcript: '',
  facts: [],
  match: null,
  protocol: null,
  stepIndex: 0,
  furthestStep: 0,
  escalated: false,
  escalatedAt: null,
  startedAt: null,
  events: [],
};

export type Action =
  | { type: 'SIGN_IN'; operator: string }
  | { type: 'CONSENT_GIVEN' }
  /**
   * Carries the site context so the record is self-contained: where SANA was
   * and what number it had are facts about the incident, and reading them off
   * a store that can be edited afterwards would make the record a view of
   * today's settings rather than of what happened.
   */
  | { type: 'START_EMERGENCY'; context: SiteContext }
  | { type: 'TRANSCRIPT'; text: string }
  | { type: 'MATCHING' }
  | { type: 'MATCHED'; match: Match }
  | { type: 'UNMATCHED' }
  /** The only door into GUIDING. */
  | { type: 'HUMAN_CONFIRMED' }
  | { type: 'HUMAN_REJECTED' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  /** Recorded when locked library wording is read aloud. Provenance, not prose. */
  | { type: 'SPOKE'; ref: string }
  /** Recorded after the human taps the dial control. SANA never dials. */
  | { type: 'HUMAN_TAPPED_CALL'; number: string }
  | { type: 'RESOLVE' }
  | { type: 'VIEW_HANDOVER' }
  | { type: 'BACK_TO_LIVE' }
  | { type: 'RESET' };

/**
 * Record one event.
 *
 * Deterministic system code, master prompt section 1.5: every call site below
 * is a thing that demonstrably happened, written the instant it happened. No
 * model reaches this function, and nothing here infers anything.
 */
const log = (
  state: State,
  kind: EventKind,
  detail: string,
  data?: EventData,
): readonly LoggedEvent[] => append(state.events, kind, detail, data);

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, operator: action.operator, screen: 'consent' };

    case 'CONSENT_GIVEN':
      return {
        ...state,
        consented: true,
        screen: 'standby',
        events: log(state, 'consent', 'Operator accepted the terms and gave consent'),
      };

    case 'START_EMERGENCY': {
      // A fresh incident. Everything from any previous one is cleared so no
      // observation can bleed across incidents into a new record.
      const startedAt = Date.now();
      const { site, zone, emergencyNumber, safetyOfficer, hospital } = action.context;
      return {
        ...initialState,
        incidentId: newIncidentId(startedAt),
        operator: state.operator,
        consented: true,
        screen: 'live',
        phase: 'listening',
        startedAt,
        // The site is recorded here, not read at render time, so the sheet
        // reports where SANA was during the incident even if the settings are
        // edited afterwards.
        events: append([], 'started', 'Emergency session started', {
          operator: state.operator,
          site,
          zone,
          emergencyNumber,
          safetyOfficer,
          hospital,
        }, startedAt),
      };
    }

    case 'TRANSCRIPT':
      return { ...state, transcript: action.text };

    case 'MATCHING':
      return {
        ...state,
        phase: 'matching',
        events: log(state, 'described', state.transcript, { transcript: state.transcript }),
      };

    case 'MATCHED':
      return {
        ...state,
        phase: 'confirming',
        match: action.match,
        facts: action.match.matched,
        events: log(
          state,
          'suggested',
          `Suggested "${action.match.protocol.title}" (${Math.round(action.match.confidence * 100)}% confidence) — awaiting human confirmation`,
          {
            protocolId: action.match.protocol.id,
            title: action.match.protocol.title,
            confidence: action.match.confidence,
            // Which selector chose it. The record must be able to say whether
            // a model was in the loop for this match, not merely that a match
            // happened.
            selector: action.match.selector,
            observed: action.match.matched.join('; '),
          },
        ),
      };

    case 'UNMATCHED':
      return {
        ...state,
        phase: 'unmatched',
        match: null,
        events: log(state, 'unmatched', 'No confident match — advised calling for help', {
          transcript: state.transcript,
        }),
      };

    case 'HUMAN_CONFIRMED': {
      // Guard, not decoration: without a suggestion on the table there is
      // nothing a human could have confirmed, so this cannot open the door.
      if (state.phase !== 'confirming' || !state.match) return state;
      return {
        ...state,
        phase: 'guiding',
        protocol: state.match.protocol,
        stepIndex: 0,
        furthestStep: 0,
        events: log(state, 'confirmed', `Human confirmed: ${state.match.protocol.title}`, {
          protocolId: state.match.protocol.id,
          title: state.match.protocol.title,
          totalSteps: state.match.protocol.steps.length,
        }),
      };
    }

    case 'HUMAN_REJECTED':
      return {
        ...state,
        phase: 'listening',
        match: null,
        transcript: '',
        facts: [],
        events: log(
          state,
          'rejected',
          state.match
            ? `Human rejected the suggested match: ${state.match.protocol.title}`
            : 'Human rejected the suggested match',
          state.match ? { protocolId: state.match.protocol.id, title: state.match.protocol.title } : undefined,
        ),
      };

    case 'NEXT_STEP': {
      if (state.phase !== 'guiding' || !state.protocol) return state;
      const last = state.protocol.steps.length - 1;
      if (state.stepIndex >= last) {
        return {
          ...state,
          phase: 'resolved',
          events: log(state, 'completed', `Completed all ${state.protocol.steps.length} steps`, {
            protocolId: state.protocol.id,
            totalSteps: state.protocol.steps.length,
          }),
        };
      }
      const next = state.stepIndex + 1;
      return {
        ...state,
        stepIndex: next,
        furthestStep: Math.max(state.furthestStep, next),
        events: log(state, 'step', `Step ${next + 1} of ${state.protocol.steps.length} read`, {
          protocolId: state.protocol.id,
          n: next + 1,
          totalSteps: state.protocol.steps.length,
          direction: 'forward',
        }),
      };
    }

    case 'PREV_STEP': {
      // Recorded like any other move. A record that showed only forward
      // progress would be a tidier story than the one that actually happened.
      if (state.stepIndex <= 0 || !state.protocol) return state;
      const back = state.stepIndex - 1;
      return {
        ...state,
        stepIndex: back,
        events: log(state, 'step', `Went back to step ${back + 1} of ${state.protocol.steps.length}`, {
          protocolId: state.protocol.id,
          n: back + 1,
          totalSteps: state.protocol.steps.length,
          direction: 'back',
        }),
      };
    }

    case 'SPOKE':
      // Provenance for what was read aloud. Only a reference is stored: the
      // wording itself lives in the frozen library, and duplicating it into
      // the log would create a second copy that could drift from the reviewed
      // one.
      return { ...state, events: log(state, 'spoke', `Read aloud: ${action.ref}`, { ref: action.ref }) };

    case 'HUMAN_TAPPED_CALL':
      // Recording only. Nothing here dials -- the screen renders a tel: link
      // and the human taps it. Idempotent, so a second tap does not rewrite
      // the time the first call was made.
      if (state.escalated) return state;
      return {
        ...state,
        escalated: true,
        escalatedAt: Date.now(),
        events: log(state, 'escalated', 'Human tapped call for help', { number: action.number }),
      };

    case 'RESOLVE':
      return {
        ...state,
        phase: 'resolved',
        screen: 'handover',
        events: log(state, 'resolved', 'Session ended by the operator'),
      };

    case 'VIEW_HANDOVER':
      return { ...state, screen: 'handover', events: log(state, 'viewed', 'Handover record opened') };

    case 'BACK_TO_LIVE':
      return { ...state, screen: 'live' };

    case 'RESET':
      return { ...initialState, operator: state.operator, consented: true, screen: 'standby' };

    default:
      return state;
  }
};

/**
 * Wraps the reducer so every state carries the screen it came from.
 *
 * Kept here rather than in a component effect: which screen we just left is a
 * fact about the transition, and the reducer is the only thing that knows a
 * transition happened.
 */
export const reducerWithHistory = (state: State, action: Action): State => {
  const next = reducer(state, action);
  return next.screen === state.screen ? next : { ...next, previousScreen: state.screen };
};

export const currentStep = (state: State) =>
  state.protocol ? state.protocol.steps[state.stepIndex] ?? null : null;

export const PHASE_LABEL: Record<Phase, string> = {
  listening: 'Listening',
  matching: 'Thinking',
  confirming: 'Needs you',
  guiding: 'Guiding',
  unmatched: 'Cannot match',
  resolved: 'Resolved',
};
