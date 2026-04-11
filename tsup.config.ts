import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'modules/pii/index': 'src/modules/pii/index.ts',
    'modules/schema/index': 'src/modules/schema/index.ts',
    'modules/injection/index': 'src/modules/injection/index.ts',
    'modules/budget/index': 'src/modules/budget/index.ts',
    'adapters/vercel': 'src/adapters/vercel.ts',
    'adapters/langchain': 'src/adapters/langchain.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['zod'],
  esbuildOptions(options) {
    options.footer = {
      js: '// @edwinfom/ai-guard — built with ❤ by Edwin Fom',
    };
  },
});
