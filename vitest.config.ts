import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/**/*.spec.ts', 'packages/**/*.spec.{ts,tsx}'],
    server: {
      deps: {
        // `@deepseek-ai/dsh-client-ui-primitives` ships bare ESM that imports its
        // own CSS Modules; DSH's web shell compiles those at build time, and the
        // Client bundle never sees them because the package is an external the
        // browser module table answers. Vitest externalizes `node_modules` by
        // default, so Node's ESM loader meets a `.css` specifier and refuses the
        // extension. Inlining routes it through Vite instead, which handles CSS —
        // the styles themselves are irrelevant to these specs, which assert
        // roles, names and behaviour rather than computed style.
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
})
