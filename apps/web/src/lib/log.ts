/**
 * The append-only event log — master prompt section 1.5.
 *
 * This is the system's memory and the source of truth for the handover record.
 * Three properties matter, and each one is enforced here rather than asked for
 * politely:
 *
 *   - **Append-only.** `append` is the only writer, and it never rewrites or
 *     reorders what is already there. `extends_` checks the property, and
 *     `persist` refuses a write that would violate it, so a bug upstream loses
 *     the write rather than corrupting the record.
 *   - **Ordered.** `seq` is 1-based and gapless, because two events in the
 *     same millisecond are otherwise indistinguishable and `at` alone cannot
 *     order them. Timestamps are clamped non-decreasing, so a clock that steps
 *     backwards mid-incident cannot make the record read out of order.
 *   - **System-written.** Every field is produced by deterministic code from
 *     something that actually happened. No model writes here, and nothing in
 *     this module infers, summarises or interprets.
 *
 * `detail` is the sentence a human reads. `data` carries the same facts in a
 * structured form so the handover can be *derived* rather than reconstructed
 * by parsing prose back out of English.
 */

export type EventKind =
  | 'started'
  | 'consent'
  | 'described'
  | 'suggested'
  | 'unmatched'
  | 'confirmed'
  | 'rejected'
  | 'step'
  | 'spoke'
  | 'selector'
  | 'completed'
  | 'escalated'
  | 'resolved'
  | 'viewed';

/** What may be recorded against an event: facts, never prose SANA invented. */
export type EventData = Readonly<Record<string, string | number | boolean>>;

export interface LoggedEvent {
  /** 1-based, strictly increasing, no gaps. The true order of the record. */
  readonly seq: number;
  /** Epoch milliseconds, clamped so it never decreases across the log. */
  readonly at: number;
  readonly kind: EventKind;
  /** The sentence a human reads. Written by this system, never by a model. */
  readonly detail: string;
  readonly data?: EventData;
}

/**
 * Add one event. The only way anything enters the log.
 *
 * `now` is injectable so tests can pin time; production never passes it.
 */
export const append = (
  events: readonly LoggedEvent[],
  kind: EventKind,
  detail: string,
  data?: EventData,
  now: number = Date.now(),
): readonly LoggedEvent[] => {
  const last = events[events.length - 1];
  const event: LoggedEvent = {
    seq: (last?.seq ?? 0) + 1,
    // Never let a backwards clock invert the record.
    at: last ? Math.max(now, last.at) : now,
    kind,
    detail,
    ...(data ? { data } : {}),
  };
  return [...events, event];
};

/** True when `after` is `before` with zero or more events added to the end. */
export const extends_ = (
  before: readonly LoggedEvent[],
  after: readonly LoggedEvent[],
): boolean => {
  if (after.length < before.length) return false;
  for (let i = 0; i < before.length; i += 1) {
    const a = before[i];
    const b = after[i];
    if (!a || !b) return false;
    if (a.seq !== b.seq || a.at !== b.at || a.kind !== b.kind || a.detail !== b.detail) {
      return false;
    }
    if (JSON.stringify(a.data ?? null) !== JSON.stringify(b.data ?? null)) return false;
  }
  return true;
};

/** True when seq runs 1..n with no gaps and `at` never decreases. */
export const wellOrdered = (events: readonly LoggedEvent[]): boolean =>
  events.every((event, i) => {
    const previous = events[i - 1];
    return event.seq === i + 1 && (previous === undefined || event.at >= previous.at);
  });

/* ── Persistence ──────────────────────────────────────────────────────────
 *
 * A source of truth that a page refresh destroys is not one. The log is
 * written to localStorage after every change, so a stray reload — or a browser
 * that reaps the tab mid-incident — costs nothing.
 *
 * This stays client-side deliberately: the demo has no backend by design, and
 * an incident record that never leaves the device is the honest version of
 * that promise rather than a limitation to apologise for.
 */

const KEY = 'sana.incident-log.v1';

export interface PersistedIncident {
  readonly incidentId: string;
  readonly events: readonly LoggedEvent[];
}

/** Distinct per incident, so a resumed log is never confused with a new one. */
export const newIncidentId = (now: number = Date.now()): string =>
  `${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export const loadLog = (): PersistedIncident | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedIncident;
    if (!Array.isArray(parsed?.events) || !wellOrdered(parsed.events)) return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Write the log, refusing anything that is not an append to the same incident.
 *
 * The refusal is the point. If some future change tries to edit or reorder a
 * recorded event, the write is dropped and the stored record stays true —
 * which is the failure mode you want when the alternative is a clinician
 * reading a record that has been quietly rewritten.
 */
export const persist = (incident: PersistedIncident): boolean => {
  try {
    if (!wellOrdered(incident.events)) return false;
    const stored = loadLog();
    if (stored && stored.incidentId === incident.incidentId && !extends_(stored.events, incident.events)) {
      return false;
    }
    localStorage.setItem(KEY, JSON.stringify(incident));
    return true;
  } catch {
    return false;
  }
};

export const clearLog = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable; the in-memory log is unaffected */
  }
};
