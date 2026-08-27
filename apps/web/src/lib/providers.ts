/**
 * Where the model providers live, and whether they are configured at all.
 *
 * Read from the environment at build time, never committed. Decision 0003's
 * rule applies here as much as to the emergency number: an absent provider
 * shows as absent. Nothing here invents a default endpoint, and no key has a
 * fallback value.
 *
 * `.env.example` documents the variables. If none are set, SANA runs entirely
 * on-device — which is a supported configuration, not a degraded one.
 */

const read = (name: string): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return typeof value === 'string' ? value.trim() : '';
};

export interface ProviderConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly key: string;
}

/** The protocol selector — master prompt section 1.2. */
export const llm = (): ProviderConfig => ({
  baseUrl: read('VITE_SANA_LLM_BASE_URL'),
  model: read('VITE_SANA_LLM_MODEL'),
  key: read('VITE_SANA_LLM_KEY'),
});

/** Speech to text — master prompt section 1.1. */
export const stt = (): ProviderConfig => ({
  baseUrl: read('VITE_SANA_STT_BASE_URL'),
  model: read('VITE_SANA_STT_MODEL'),
  key: read('VITE_SANA_STT_KEY'),
});

export const configured = (provider: ProviderConfig): boolean =>
  provider.baseUrl !== '' && provider.model !== '' && provider.key !== '';

/**
 * How long a call may take before SANA stops waiting.
 *
 * Short on purpose. Someone is kneeling over a casualty; a request that has
 * not answered in this long has effectively failed, and falling back to the
 * on-device path immediately is better than a spinner.
 */
export const TIMEOUT_MS = 6_000;
