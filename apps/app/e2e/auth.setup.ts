import { expect, test as setup } from '@playwright/test'

// Dev seed ensures the default dev user exists; in the fenix template there is
// a single generic user. Projects that need distinct admin/member personas
// extend dev-seed.ts and give each persona its own email here.
const DEV_ADMIN = {
  email: 'dev@fenix.local',
  password: 'dev-password-123',
}

const DEV_MEMBER = {
  email: 'dev@fenix.local',
  password: 'dev-password-123',
}

setup('authenticate as admin', async ({ request, baseURL }) => {
  const url = baseURL ?? 'http://localhost:3001'
  const response = await request.post(`${url}/api/auth/sign-in/email`, {
    data: DEV_ADMIN,
  })
  expect(response.ok()).toBeTruthy()
  await request.storageState({ path: 'e2e/.auth/admin.json' })
})

setup('authenticate as member', async ({ request, baseURL }) => {
  const url = baseURL ?? 'http://localhost:3001'
  const response = await request.post(`${url}/api/auth/sign-in/email`, {
    data: DEV_MEMBER,
  })
  expect(response.ok()).toBeTruthy()
  await request.storageState({ path: 'e2e/.auth/member.json' })
})
