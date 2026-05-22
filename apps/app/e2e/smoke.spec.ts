import { expect, test } from '@playwright/test'

test.describe('smoke tests', () => {
  test('dashboard loads for authenticated user', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('unauthenticated user is redirected to web sign-in', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/sign-in/)
    await context.close()
  })

  test('root redirects to dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/dashboard')
  })
})
