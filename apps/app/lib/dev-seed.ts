import { auth } from '@fenix/auth'

const DEV_USER = {
  email: 'dev@fenix.local',
  password: 'dev-password-123',
  name: 'Dev User',
}

export async function seedDevUser() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEV_USERS !== 'true') return

  const existing = await auth.api
    .signInEmail({
      body: { email: DEV_USER.email, password: DEV_USER.password },
    })
    .catch(() => null)

  if (existing) return

  await auth.api.signUpEmail({
    body: DEV_USER,
  })

  console.log('[dev-seed] Created dev user:', DEV_USER.email)
}

export { DEV_USER }
