import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  clean: true,
  dts: false,
  sourcemap: true,
  // Inject Node.js shebang so `feynman` is directly executable
  banner: { js: '#!/usr/bin/env node' },
  // Bundle workspace packages into output
  noExternal: [/^@feynman\//],
});
