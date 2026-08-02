import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node20',
  clean: true,
  dts: true,
  sourcemap: false,
});
