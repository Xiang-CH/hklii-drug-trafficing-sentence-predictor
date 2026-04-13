import { URL, fileURLToPath } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    nitro(
      process.env.DEPLOY_TARGET === 'azure'
        ? {
            preset: './nitro/presets/azure-swa-custom.mjs', //'azure-swa',
            azure: {
              config: {
                routes: [
                  {
                    route: '/_serverFn/*',
                    rewrite: '/api/server',
                  },
                ],
              },
            },
          }
        : undefined,
    ) as PluginOption,
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
})

export default config
