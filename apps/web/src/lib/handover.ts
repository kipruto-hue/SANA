import type { LoggedEvent } from './log.js';

/**
 * The handover record, derived from the event log — master prompt section 1.5.
 *
 * "Derived, not reconstructed" is a real constraint, and it is what this file
 * exists to make true. `deriveHandover` is a pure function of the log: it may
 * only read events, and every field it produces has to trace to something the
 * system recorded at the moment it happened. It does not take the app's state,
 * it does not read the site-context store, and it cannot ask a model anything.
 *
 * Two failure modes it is built against:
 *
 *   - **Reading live settings.** The earlier screen composed its lines from
 *     `state.protocol` and the current site context, so editing the site after
 *     an incident would silently change the record of that incident. Site and
 *     emergency number are read from the `started` and `escalated` events
 *     instead, which are fixed at the moment they were written.
 *   - **Parsing prose.** Every fact is read from an event's structured `data`,
 *     never by pattern-matching the English in `detail`. `detail` is for a
 *     human to read; changing its wording must never change the record.
 *
 * If a fact is not in the log, it does not appear on the sheet. There is no
 * inference here, and no field is filled in from anywhere else.
 */

const str = (event: LoggedEvent | undefined, key: string): string => {
  const value = event?.data?.[key];
  return typeof value === 'string' ? value : '';
};

const num = (event: LoggedEvent | undefined, key: string): number | null => {
  const value = event?.data?.[key];
  return typeof value === 'number' ? value : null;
};

const last = (events: readonly LoggedEvent[], kind: string): LoggedEvent | undefined => {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.kind === kind) return event;
  }
  return undefined;
};

const first = (events: readonly LoggedEvent[], kind: string): LoggedEvent | undefined =>
  events.find((event) => event.kind === kind);

export interface HandoverRecord {
  readonly startedAt: number | null;
  readonly operator: string;
  readonly site: string;
  readonly zone: string;
  /** What the human described, verbatim. Never a summary of it. */
  readonly whatHappened: string;
  /** The observable cues the match was made on. */
  readonly observed: readonly string[];
  readonly protocolTitle: string;
  /** How far the guidance actually got, and how far it could have gone. */
  readonly reachedStep: number | null;
  readonly totalSteps: number | null;
  readonly completed: boolean;
  readonly escalatedAt: number | null;
  readonly escalatedNumber: string;
  readonly rejectedCount: number;
  readonly unmatched: boolean;
  /** Whether a model was in the loop for the match, and which one of us chose. */
  readonly selector: string;
  readonly timeline: readonly LoggedEvent[];
}

export const deriveHandover = (events: readonly LoggedEvent[]): HandoverRecord => {
  const started = first(events, 'started');
  const described = first(events, 'described');
  const suggested = last(events, 'suggested');
  const confirmed = last(events, 'confirmed');
  const completed = last(events, 'completed');
  const escalated = first(events, 'escalated');

  // The furthest step the guidance actually reached. Taken as a maximum over
  // every step event, so tapping Back before the session ends cannot make the
  // record understate how far the operator got.
  let reachedStep: number | null = confirmed ? 1 : null;
  for (const event of events) {
    if (event.kind !== 'step') continue;
    const n = num(event, 'n');
    if (n !== null && (reachedStep === null || n > reachedStep)) reachedStep = n;
  }

  const observedRaw = str(suggested, 'observed');

  return {
    startedAt: started?.at ?? null,
    operator: str(started, 'operator'),
    site: str(started, 'site'),
    zone: str(started, 'zone'),
    whatHappened: str(described, 'transcript'),
    observed: observedRaw ? observedRaw.split('; ').filter(Boolean) : [],
    protocolTitle: str(confirmed, 'title'),
    reachedStep,
    totalSteps: num(confirmed, 'totalSteps') ?? num(completed, 'totalSteps'),
    completed: completed !== undefined,
    escalatedAt: escalated?.at ?? null,
    escalatedNumber: str(escalated, 'number'),
    rejectedCount: events.filter((event) => event.kind === 'rejected').length,
    unmatched: events.some((event) => event.kind === 'unmatched'),
    selector: str(suggested, 'selector'),
    timeline: events,
  };
};

export const clock = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * The "what was done" lines, each one a restatement of a recorded event.
 *
 * Kept beside the derivation rather than in the screen, because these
 * sentences are the record — a component composing them is a component that
 * can be changed without anyone treating it as a change to the record.
 */
export const actionLines = (record: HandoverRecord, noneRecorded: string): readonly string[] => {
  const lines: string[] = [];

  if (record.protocolTitle && record.totalSteps !== null) {
    lines.push(
      record.completed
        ? `Followed “${record.protocolTitle}” — all ${record.totalSteps} steps read aloud.`
        : `Followed “${record.protocolTitle}” — reached step ${record.reachedStep ?? 1} of ${record.totalSteps}.`,
    );
  }
  if (record.escalatedAt !== null) {
    lines.push(
      record.escalatedNumber
        ? `Called for help on ${record.escalatedNumber} at ${clock(record.escalatedAt)}.`
        : `Called for help at ${clock(record.escalatedAt)}.`,
    );
  }
  if (record.unmatched) {
    lines.push('SANA could not match what was described, and advised calling for help.');
  }
  if (record.rejectedCount > 0) {
    lines.push(
      record.rejectedCount === 1
        ? 'An earlier suggestion was rejected by the operator.'
        : `${record.rejectedCount} earlier suggestions were rejected by the operator.`,
    );
  }

  return lines.length > 0 ? lines : [noneRecorded];
};

export interface RecordLabels {
  readonly whatHappened: string;
  readonly nothingDescribed: string;
  readonly actions: string;
  readonly notIncluded: string;
  readonly timeline: string;
  readonly noActions: string;
  readonly notIncludedItems: readonly string[];
}

/** The whole sheet as plain text, for the clipboard and the saved file. */
export const toText = (record: HandoverRecord, labels: RecordLabels): string =>
  [
    'SANA incident record',
    record.site ? `Site: ${record.site}${record.zone ? ` · ${record.zone}` : ''}` : null,
    record.operator ? `Operator: ${record.operator}` : null,
    record.startedAt ? `Started: ${new Date(record.startedAt).toLocaleString()}` : null,
    record.selector ? `Protocol chosen by: ${record.selector}` : null,
    '',
    labels.whatHappened,
    record.whatHappened || labels.nothingDescribed,
    '',
    labels.actions,
    ...actionLines(record, labels.noActions).map((action) => `- ${action}`),
    '',
    labels.notIncluded,
    ...labels.notIncludedItems.map((item) => `- ${item}`),
    '',
    labels.timeline,
    ...record.timeline.map((event) => `${clock(event.at)}  ${event.detail}`),
  ]
    .filter((row) => row !== null)
    .join('\n');

/**
 * Hand the operator the record as a file.
 *
 * There is no backend to post it to and, on the demo path, that is the design
 * rather than a gap — so the way the record leaves the device is the operator
 * deliberately saving it. Named by incident so two are never confused.
 */
export const downloadRecord = (record: HandoverRecord, labels: RecordLabels): void => {
  const stamp = new Date(record.startedAt ?? Date.now())
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  const blob = new Blob([toText(record, labels)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sana-incident-${stamp}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
