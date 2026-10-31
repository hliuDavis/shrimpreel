import { expect, test } from '@playwright/test'
import { ORIGIN, content, json, post, uniqueEmail } from './helpers'

// 所有测试仅使用本地开发认证，不调用 Google 或真实支付服务。
test('成年声明：默认不勾选、后端拒绝跳过，勾选后注册并导出声明记录', async ({ page }) => {
  const email = uniqueEmail('adult-declaration')
  await page.goto('/sign-in')
  await expect(page.getByTestId('adult-declaration')).not.toBeChecked()
  await expect(page.getByTestId('dev-login')).toBeDisabled()
  for (const value of [undefined, false, 'true', 1]) {
    const response = await post(page.request, '/api/auth/dev-login', { email, adultConfirmed: value })
    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'adult_declaration_required' })
    const start = await post(page.request, '/api/auth/google/start', { adultConfirmed: value })
    expect(start.status()).toBe(400)
  }
  expect((await json<{ user: unknown }>(page.request.get('/api/me'))).user).toBeNull()
  await page.getByTestId('dev-email').fill(email)
  await page.getByTestId('adult-declaration').check()
  await expect(page.getByTestId('dev-login')).toBeEnabled()
  await page.getByTestId('dev-login').click()
  await expect(page).toHaveURL(ORIGIN + '/dashboard')
  const data = await json<{ account: { adultDeclaredAt: string; adultDeclarationVersion: string } }>(page.request.get('/api/account/export'))
  expect(data.account.adultDeclarationVersion).toBe('18-and-local-majority-v1')
  expect(Number.isNaN(Date.parse(data.account.adultDeclaredAt))).toBe(false)
})

test('成年声明：旧 OAuth 入口、过期回调和 One Tap 都不能绕过', async ({ page }) => {
  await page.goto('/api/auth/google/start?redirect=%2Fpricing&adultConfirmed=true')
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fpricing$/)
  await expect(page.getByTestId('adult-declaration')).not.toBeChecked()
  await page.goto('/api/auth/google/callback?code=fake&state=fake')
  await expect(page.getByRole('alert')).toHaveText(content.en.errors.adult_declaration_expired)
  expect((await page.request.get('/api/auth/google/nonce')).status()).toBe(404)
  expect((await post(page.request, '/api/auth/google/one-tap', { adultConfirmed: true, credential: 'fake' })).status()).toBe(404)
  expect((await json<{ user: unknown }>(page.request.get('/api/me'))).user).toBeNull()
  expect(await page.locator('script[src*="accounts.google.com/gsi"]').count()).toBe(0)
})
