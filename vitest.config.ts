import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'apps/*/src/**/*.test.tsx'],
    // The library-integrity tests edit content files on disk and restore them
    // afterwards. Parallel files would race over the same bytes and produce
    // failures that look like integrity bugs but are test infrastructure.
    fileParallelism: false,
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
