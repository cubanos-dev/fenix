export async function register() {
  const shouldSeed =
    process.env.NEXT_RUNTIME === 'nodejs' &&
    (process.env.NODE_ENV !== 'production' || process.env.SEED_DEV_USERS === 'true')

  if (shouldSeed) {
    const { seedDevUser } = await import('./lib/dev-seed')
    await seedDevUser()
  }
}
