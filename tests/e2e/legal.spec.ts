import { site } from '../../src/config/site'
import { en } from '../../src/content/en'
import { expect, test } from '@playwright/test'
import { devLogin, json, post, uniqueEmail } from './helpers'

test('积分包模式：拒绝新订阅订单，法律页无订阅段落并标注资料未齐的草稿', async ({ page }) => {
  test.skip(site.subscriptionsEnabled, '仅对积分包站点检查新订阅被拒绝')
  await devLogin(page.request, uniqueEmail('packs-only'))
  for (const packageId of ['monthly', 'yearly']) {
    const response = await post(page.request, '/api/checkout', { packageId, locale: 'en' })
    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_package' })
  }
  expect((await json<{ orders: unknown[] }>(page.request.get('/api/orders'))).orders).toEqual([])
  for (const path of ['/privacy-policy', '/terms-of-service', '/refund-policy']) {
    await page.goto(path)
    if (en(site).legal.notice) await expect(page.getByRole('note')).toContainText('Pre-launch draft')
    else await expect(page.getByRole('note')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /^Subscriptions?$/ })).toHaveCount(0)
  }
})

test('举报声明按类型显示，改变类型后必须重新确认', async ({ page }) => {
  await page.goto('/report')
  await page.locator('[name="attest"]').check()
  await page.locator('[name="reason"]').selectOption('copyright')
  await expect(page.locator('[name="attest"]')).not.toBeChecked()
  await expect(page.locator('label').filter({ has: page.locator('[name="attest"]') })).toContainText('violates the rights or rules')
  await page.locator('[name="reason"]').selectOption('intimate')
  await expect(page.locator('label').filter({ has: page.locator('[name="attest"]') })).toContainText('without consent')
})
