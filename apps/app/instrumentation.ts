export async function register() {
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { seedDevUser } = await import('./lib/dev-seed')
    await seedDevUser()
  }
}
