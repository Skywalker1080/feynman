import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  clean: true,
  dts: false,
  sourcemap: true,
  // Inject Node.js shebang so `feynman-server` is directly executable
  banner: { js: '#!/usr/bin/env node' },
  // better-sqlite3 is a native addon (.node file) — must NOT be bundled
  external: ['better-sqlite3'],
  // Bundle workspace packages into the output so the binary is self-contained
  noExternal: [/^@feynman\//],
});
