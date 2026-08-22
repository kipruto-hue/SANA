/**
 * Where SANA is deployed — read at runtime, never compiled in.
 *
 * Decision 0003: no seeded or stationary data. The emergency number, the site,
 * the hospital and the safety officer are stored, and until they are stored
 * the interface says so plainly. A wrong emergency number is worse than a
 * missing one: a missing one is visible, and a plausible default is the kind
 * of thing a frightened person dials.
 *
 * This reads localStorage for now; it moves behind GET /api/context when the
 * server exists. Nothing outside this module knows where the values came from.
 */

export interface SiteContext {
  readonly site: string;
  readonly zone: string;
  readonly emergencyNumber: string;
  readonly hospital: string;
  readonly safetyOfficer: string;
  readonly kitLocation: string;
}

const KEY = 'sana.site-context.v1';

export const EMPTY_CONTEXT: SiteContext = {
  site: '',
  zone: '',
  emergencyNumber: '',
  hospital: '',
  safetyOfficer: '',
  kitLocation: '',
};

export const loadContext = (): SiteContext => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_CONTEXT;
    return { ...EMPTY_CONTEXT, ...(JSON.parse(raw) as Partial<SiteContext>) };
  } catch {
    return EMPTY_CONTEXT;
  }
};

export const saveContext = (context: SiteContext): void => {
  localStorage.setItem(KEY, JSON.stringify(context));
};

/** The dial control is only live once a number has actually been configured. */
export const canDial = (context: SiteContext): boolean =>
  context.emergencyNumber.trim().length > 0;

export const isConfigured = (context: SiteContext): boolean =>
  canDial(context) && context.site.trim().length > 0;
