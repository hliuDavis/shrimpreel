import { describe, expect, it } from 'vitest'
import { site, sellingPlans, findPlan } from '#/config/site'
import { en } from '#/content/en'
import { zh } from '#/content/zh'

// 核对实际生成的页面文案与售卖配置一致，不把测试结果当成法律认证。
describe('积分包站点的法律文案', () => {
  it('关闭新订阅销售，仍保留历史计划供退款与账单处理', () => {
    expect(sellingPlans).toEqual(site.subscriptionsEnabled ? site.plans : [])
    expect(findPlan('monthly')).toBeDefined()
    expect(findPlan('yearly')).toBeDefined()
  })
  it('中英文退款和条款不展示订阅段落，缺少主体资料时明确标注草稿', () => {
    const draft = { ...site, subscriptionsEnabled: false, legal: { ...site.legal, operatorName: '' } }
    for (const c of [en(draft), zh(draft)]) {
      expect(c.legal.notice).not.toBe('')
      expect(c.legal.terms.sections.some(s => /Subscriptions|订阅/.test(s.h))).toBe(false)
      expect(c.legal.refund.sections.some(s => /Subscription|订阅/.test(s.h))).toBe(false)
      expect(c.report.attestGeneral).not.toBe(c.report.attest)
    }
  })
  it('退款保留法定权利，成年要求与声明一致，删除说明不承诺立即抹除全部记录', () => {
    const legal = en({ ...site, subscriptionsEnabled: false }).legal
    const refund = JSON.stringify(legal.refund)
    expect(refund).toContain('mandatory consumer rights')
    expect(refund).toContain('does not by itself mean that you waive')
    expect(refund).not.toContain('5–10 business days')
    expect(JSON.stringify(legal.terms)).toContain('at least 18 years old and')
    expect(JSON.stringify(legal.privacy)).toContain('does not immediately erase every record')
    expect(JSON.stringify(legal.privacy)).not.toContain('keep only a one-way hash')
  })
})
