import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

/**
 * Vite plugin: resolves '.js' imports to their '.ts' counterpart during tests.
 * Required because TypeScript ESM source files use '.js' extensions per convention,
 * but only '.ts' files exist in the src directory.
 */
function resolveTsExtensions(): Plugin {
  return {
    name: 'resolve-ts-extensions',
    enforce: 'pre',
    resolveId(source: string, importer?: string) {
      if (!importer || !source.endsWith('.js')) return;
      const dir = dirname(importer.startsWith('file://') ? fileURLToPath(importer) : importer);
      const tsPath = resolve(dir, source.replace(/\.js$/, '.ts'));
      if (existsSync(tsPath)) return tsPath;
    },
  };
}

export default defineConfig({
  plugins: [resolveTsExtensions()],
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**'],
    },
  },
});
