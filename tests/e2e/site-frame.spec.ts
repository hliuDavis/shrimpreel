import { expect, test, type Page } from '@playwright/test'
import { ARTICLES } from '../../src/config/site'
import { buyPackage, devLogin, uniqueEmail } from './helpers'

async function inspectFrame(page: Page) {
  await expect(page.getByTestId('site-frame')).toHaveCount(1)
  await expect(page.getByTestId('site-footer')).toHaveCount(1)
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toHaveClass(/public-footer/)
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>('[data-testid="site-frame"]')!
    const footer = document.querySelector<HTMLElement>('[data-testid="site-footer"]')!
    const nav = frame.querySelector<HTMLElement>('header > nav')!
    return {
      background: getComputedStyle(frame).backgroundColor,
      footer: getComputedStyle(footer).backgroundColor,
      navHeight: nav.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth > innerWidth,
      frameHeight: frame.getBoundingClientRect().height,
      viewportHeight: innerHeight,
    }
  })
}

test('所有用户页面共用新版外框：法律、联系、登录、文章、分享、支付、个人中心和404', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  const publicPaths = ['/', '/guides', '/pricing', '/privacy-policy', '/terms-of-service', '/refund-policy', '/contact', '/report', '/sign-in', ...ARTICLES.map(a => '/' + a.slug), '/v/missing-preview', '/unknown-layout-page']
  await page.goto('/')
  const baseline = await inspectFrame(page)
  for (const prefix of ['', '/zh']) {
    for (const path of publicPaths) {
      await page.goto(prefix + path)
      const view = await inspectFrame(page)
      expect(view.background, prefix + path).toBe(baseline.background)
      expect(view.footer, prefix + path).toBe(baseline.footer)
      expect(view.navHeight, prefix + path).toBe(baseline.navHeight)
      expect(view.overflow, prefix + path).toBe(false)
      expect(view.frameHeight).toBeGreaterThanOrEqual(view.viewportHeight)
    }
  }
  await devLogin(page.request, uniqueEmail('site-frame'))
  const orderId = await buyPackage(page.request, 'starter')
  for (const path of ['/dashboard', '/dashboard/billing', '/dashboard/settings', '/dashboard/orders/' + orderId, '/checkout/success?order=' + orderId, '/checkout/mock?order=' + orderId]) {
    await page.goto(path)
    const view = await inspectFrame(page)
    expect(view.footer, path).toBe(baseline.footer)
    expect(view.background, path).toBe(baseline.background)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/privacy-policy', '/contact', '/dashboard/settings', '/unknown-layout-page']) {
    await page.goto(path)
    expect((await inspectFrame(page)).overflow, path).toBe(false)
  }
})

test('从首页点击法律页链接后页脚保持一致，深色模式仍使用相同主题', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/')
  const before = await inspectFrame(page)
  await page.getByTestId('site-footer').getByRole('link', { name: 'Privacy Policy', exact: true }).click()
  await expect(page).toHaveURL(/\/privacy-policy$/)
  const after = await inspectFrame(page)
  expect(after.footer).toBe(before.footer)
  expect(after.background).toBe(before.background)
})
