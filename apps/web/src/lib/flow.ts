import type { Match, Protocol } from './library.js';

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

export interface IncidentEvent {
  readonly at: number;
  readonly kind: string;
  readonly detail: string;
}

export interface State {
  readonly screen: Screen;
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
  readonly escalated: boolean;
  readonly startedAt: number | null;
  readonly events: readonly IncidentEvent[];
}

export const initialState: State = {
  screen: 'welcome',
  previousScreen: 'welcome',
  phase: 'listening',
  operator: '',
  consented: false,
  transcript: '',
  facts: [],
  match: null,
  protocol: null,
  stepIndex: 0,
  escalated: false,
  startedAt: null,
  events: [],
};

export type Action =
  | { type: 'SIGN_IN'; operator: string }
  | { type: 'CONSENT_GIVEN' }
  | { type: 'START_EMERGENCY' }
  | { type: 'TRANSCRIPT'; text: string }
  | { type: 'MATCHING' }
  | { type: 'MATCHED'; match: Match }
  | { type: 'UNMATCHED' }
  /** The only door into GUIDING. */
  | { type: 'HUMAN_CONFIRMED' }
  | { type: 'HUMAN_REJECTED' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  /** Recorded after the human taps the dial control. SANA never dials. */
  | { type: 'HUMAN_TAPPED_CALL' }
  | { type: 'RESOLVE' }
  | { type: 'VIEW_HANDOVER' }
  | { type: 'BACK_TO_LIVE' }
  | { type: 'RESET' };

const log = (state: State, kind: string, detail: string): IncidentEvent[] => [
  ...state.events,
  { at: Date.now(), kind, detail },
];

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
      return {
        ...initialState,
        operator: state.operator,
        consented: true,
        screen: 'live',
        phase: 'listening',
        startedAt,
        events: [{ at: startedAt, kind: 'started', detail: 'Emergency session started' }],
      };
    }

    case 'TRANSCRIPT':
      return { ...state, transcript: action.text };

    case 'MATCHING':
      return {
        ...state,
        phase: 'matching',
        events: log(state, 'described', state.transcript),
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
        ),
      };

    case 'UNMATCHED':
      return {
        ...state,
        phase: 'unmatched',
        match: null,
        events: log(state, 'unmatched', 'No confident match — advised calling for help'),
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
        events: log(state, 'confirmed', `Human confirmed: ${state.match.protocol.title}`),
      };
    }

    case 'HUMAN_REJECTED':
      return {
        ...state,
        phase: 'listening',
        match: null,
        transcript: '',
        facts: [],
        events: log(state, 'rejected', 'Human rejected the suggested match'),
      };

    case 'NEXT_STEP': {
      if (state.phase !== 'guiding' || !state.protocol) return state;
      const last = state.protocol.steps.length - 1;
      if (state.stepIndex >= last) {
        return {
          ...state,
          phase: 'resolved',
          events: log(state, 'completed', `Completed all ${state.protocol.steps.length} steps`),
        };
      }
      const next = state.stepIndex + 1;
      return {
        ...state,
        stepIndex: next,
        events: log(state, 'step', `Step ${next + 1} of ${state.protocol.steps.length} read`),
      };
    }

    case 'PREV_STEP':
      return state.stepIndex > 0 ? { ...state, stepIndex: state.stepIndex - 1 } : state;

    case 'HUMAN_TAPPED_CALL':
      return {
        ...state,
        escalated: true,
        events: log(state, 'escalated', 'Human tapped call for help'),
      };

    case 'RESOLVE':
      return {
        ...state,
        phase: 'resolved',
        screen: 'handover',
        events: log(state, 'resolved', 'Session ended by the operator'),
      };

    case 'VIEW_HANDOVER':
      return { ...state, screen: 'handover' };

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
