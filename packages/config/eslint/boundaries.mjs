// Architectural boundary rules — opt-in ESLint flat-config fragment.
//
// Why each rule exists:
//  - apps/web vs apps/app cross-imports: the two apps ship as separate
//    Vercel services on different subdomains. Cross-imports couple their
//    build graphs and smuggle runtime assumptions between deployables.
//  - packages/ui → packages/db|auth: `@fenix/ui` is framework-agnostic and
//    must not pull in server-only deps. Importing the DB or auth client
//    from a primitive drags a DATABASE_URL / server env onto the client
//    bundle and breaks tree-shaking.
//  - packages/domain → other workspaces: domain types/functions are a leaf
//    dependency. Other packages depend on domain, never the other way. An
//    inbound edge would create a cycle and couple business rules to
//    infrastructure choices.
//  - components/** → packages/db: UI components must go through a service
//    layer (server action, route handler, loader). Direct DB imports from a
//    component skip auth checks and collapse layering.
//
// Consumers load this fragment by spreading it into their flat config after
// the base `@fenix/eslint-config`. Example:
//
//   import base from '@fenix/eslint-config'
//   import boundaries from '@fenix/eslint-config/boundaries'
//   export default [...base, ...boundaries]

import boundariesPlugin from 'eslint-plugin-boundaries'

const elements = [
  { type: 'app-web', pattern: 'apps/web/**/*' },
  { type: 'app-app', pattern: 'apps/app/**/*' },
  { type: 'app-components', pattern: 'apps/*/components/**/*' },
  { type: 'app-screen', pattern: 'apps/*/app/**/_components/**/*' },
  { type: 'pkg-ui', pattern: 'packages/ui/**/*' },
  { type: 'pkg-domain', pattern: 'packages/domain/**/*' },
  { type: 'pkg-db', pattern: 'packages/db/**/*' },
  { type: 'pkg-auth', pattern: 'packages/auth/**/*' },
  { type: 'pkg-email', pattern: 'packages/email/**/*' },
  { type: 'pkg-storage', pattern: 'packages/storage/**/*' },
]

const boundariesConfig = [
  {
    plugins: { boundaries: boundariesPlugin },
    settings: {
      'boundaries/elements': elements,
      'boundaries/include': ['apps/**/*', 'packages/**/*'],
    },
    rules: {
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-files': 'off',
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['app-web'],
              disallow: ['app-app'],
              message: 'apps/web cannot import from apps/app — they deploy as separate services.',
            },
            {
              from: ['app-app'],
              disallow: ['app-web'],
              message: 'apps/app cannot import from apps/web — they deploy as separate services.',
            },
            {
              from: ['pkg-ui'],
              disallow: ['pkg-db', 'pkg-auth'],
              message: '@fenix/ui must stay framework-agnostic — no db/auth imports.',
            },
            {
              from: ['pkg-domain'],
              disallow: [
                'app-web',
                'app-app',
                'app-components',
                'app-screen',
                'pkg-ui',
                'pkg-db',
                'pkg-auth',
                'pkg-email',
                'pkg-storage',
              ],
              message: '@fenix/domain is a leaf package — it must not depend on other workspaces.',
            },
            {
              from: ['app-components', 'app-screen', 'pkg-ui'],
              disallow: ['pkg-db'],
              message: 'Components must not import @fenix/db directly — go through a service layer.',
            },
          ],
        },
      ],
    },
  },
]

export default boundariesConfig
