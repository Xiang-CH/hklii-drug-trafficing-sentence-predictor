import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const runtimeEntry = resolve(__dirname, '../runtime/azure-swa.mjs')

export default {
  extends: 'azure-swa',
  entry: runtimeEntry,
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
