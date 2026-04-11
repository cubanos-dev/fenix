import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Architectural boundary rules are exposed as a separate entry point
// (`@fenix/eslint-config/boundaries`) so consumers can opt in per workspace.
// Enabling them globally here would break any consumer whose import graph has
// not yet been cleaned up, so opt-in is the safer default for the starter.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'dist/**', 'next-env.d.ts']),
])

export default eslintConfig
