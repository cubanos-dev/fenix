import { test as setup, expect } from '@playwright/test'

const DEV_USER = {
  email: 'dev@fenix.local',
  password: 'dev-password-123',
}

setup('authenticate as dev user', async ({ request }) => {
  const response = await request.post('http://localhost:3001/api/auth/sign-in/email', {
    data: DEV_USER,
  })
  expect(response.ok()).toBeTruthy()

  await request.storageState({ path: 'e2e/.auth/user.json' })
})
