import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The protocol library and the design system live outside this app's root.
    // They are imported directly rather than copied, so there is exactly one
    // source of medical wording and one source of design tokens.
    fs: { allow: [repoRoot] },
  },
});
