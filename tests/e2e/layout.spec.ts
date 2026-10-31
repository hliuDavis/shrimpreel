import { expect, test } from '@playwright/test'
import { devLogin, uniqueEmail } from './helpers'

test('公开页精简布局：导航随登录变化、生成入口与积分包保留、Guide 两栏对齐', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('generator-sign-up')).toBeVisible()
  const nav = page.getByRole('banner')
  for (const name of ['Create', 'Guide', 'Pricing']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'My Account', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-testid^="style-"]')).toHaveCount(0)
  await expect(page.getByTestId('photo-input')).toHaveCount(1)
  await expect(page.getByTestId('duration-short')).toBeVisible()
  await expect(page.locator('#pricing, #problem, #compare, #how-it-works')).toHaveCount(0)

  await nav.getByRole('link', { name: 'Guide', exact: true }).click()
  await expect(page.locator('.public-guide-columns')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Questions, answered' })).toBeVisible()
  const comparison = await page.locator('.public-comparison').boundingBox()
  const questions = await page.locator('.public-guide-faq > div > div').last().boundingBox()
  expect(comparison).not.toBeNull()
  expect(questions).not.toBeNull()
  expect(Math.abs(comparison!.x - questions!.x)).toBeLessThan(2)
  await page.locator('.public-guide-faq summary').first().click()
  await expect(page.locator('.public-guide-faq details').first()).toHaveAttribute('open', '')

  await nav.getByRole('link', { name: 'Pricing', exact: true }).click()
  await expect(page.getByTestId('buy-starter')).toBeVisible()
  await expect(page.locator('[data-testid^="plan-"]')).toHaveCount(0)
  await expect(page.getByTestId('buy-monthly')).toHaveCount(0)

  await devLogin(page.request, uniqueEmail('layout'))
  await page.reload()
  await expect(nav.getByRole('link', { name: 'My Account', exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'My Account', exact: true }).click()
  await expect(page.getByTestId('dashboard-credits')).toBeVisible()
  await expect(page.locator('.public-site')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/guides')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
