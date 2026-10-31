import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adultDeclaration, adultFlowCookie, beginAdultFlow, consumeAdultFlow, clearExpiredAdultFlows, ADULT_DECLARATION_VERSION } from '#/server/adult-declaration'
import { app } from '#/server/app'
import * as google from '#/server/google'
import { d1Shim, kvShim, migrate } from './d1-sqlite'

let sqlite: DatabaseSync
let env: Env
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  migrate(sqlite)
  env = { DB: d1Shim(sqlite), KV: kvShim(), APP_ENV: 'development', SITE_URL: 'https://site.example', GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', ADMIN_EMAILS: '', SESSION_SECRET: 'unit-test-session-secret-0123456789abcdef' } as unknown as Env
})
afterEach(() => { sqlite.close(); vi.restoreAllMocks() })
const oauth = (state = 'state-a') => ({ state, verifier: 'verifier', nonce: 'nonce', redirect: '/dashboard' })
const post = (body: unknown, origin = 'https://site.example') => app.request('/api/auth/google/start', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
}, env)

describe('成年声明：服务端准入与一次性回调', () => {
  it.each([undefined, null, false, 'true', 1, {}, []])('拒绝非布尔 true 的声明 %j', async (value) => {
    expect(() => adultDeclaration(value)).toThrow('adult_declaration_required')
    const response = await post({ adultConfirmed: value })
    expect(response.status).toBe(400)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM adult_oauth_flows').get()).toEqual({ n: 0 })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 })
  })

  it('同源校验先于创建流程；旧 GET 只能回到声明页', async () => {
    expect((await post({ adultConfirmed: true }, 'https://evil.example')).status).toBe(403)
    const res = await app.request('/api/auth/google/start?adultConfirmed=true', {}, env)
    expect(res.headers.get('location')).toContain('/sign-in?redirect=')
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM adult_oauth_flows').get()).toEqual({ n: 0 })
  })

  it('令牌或 state 错误、过期、版本不符时不能消费', async () => {
    const token = await beginAdultFlow(env.DB, adultDeclaration(true), oauth())
    await expect(consumeAdultFlow(env.DB, undefined, 'state-a')).rejects.toThrow('adult_declaration_expired')
    await expect(consumeAdultFlow(env.DB, 'A'.repeat(43), 'state-a')).rejects.toThrow('adult_declaration_expired')
    await expect(consumeAdultFlow(env.DB, token, 'wrong')).rejects.toThrow('adult_declaration_expired')
    await expect(consumeAdultFlow(env.DB, token, 'state-a', new Date(Date.now() + 600_001))).rejects.toThrow('adult_declaration_expired')
    sqlite.prepare('UPDATE adult_oauth_flows SET declaration_version = ?').run('obsolete')
    await expect(consumeAdultFlow(env.DB, token, 'state-a')).rejects.toThrow('adult_declaration_expired')
  })

  it('并发与重放只有一个回调能消费；临时记录按时清理', async () => {
    const token = await beginAdultFlow(env.DB, adultDeclaration(true), oauth())
    const result = await Promise.allSettled([consumeAdultFlow(env.DB, token, 'state-a'), consumeAdultFlow(env.DB, token, 'state-a')])
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    await expect(consumeAdultFlow(env.DB, token, 'state-a')).rejects.toThrow('adult_declaration_expired')
    await beginAdultFlow(env.DB, adultDeclaration(true), oauth('next'))
    await clearExpiredAdultFlows(env.DB, new Date(Date.now() + 600_001))
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM adult_oauth_flows').get()).toEqual({ n: 0 })
  })

  it('生产 cookie 使用 __Host 前缀、Secure、HttpOnly 和根路径', async () => {
    env.APP_ENV = 'production'
    const response = await post({ adultConfirmed: true })
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(adultFlowCookie(true) + '=')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=600')
    expect(cookie).not.toContain('Domain=')
  })

  it('有效回调创建用户并记录声明；重放不再换 token 或创建用户', async () => {
    const exchange = vi.spyOn(google, 'exchangeGoogleCode').mockResolvedValue({ sub: 'google-sub', email: 'adult@example.com', name: 'Adult', picture: null })
    const response = await post({ adultConfirmed: true, redirect: '/pricing?a=1|2' })
    const { url } = await response.json() as { url: string }
    const token = /adult_oauth=([^;]+)/.exec(response.headers.get('set-cookie')!)![1]!
    const callback = '/api/auth/google/callback?code=code&state=' + new URL(url).searchParams.get('state')
    const first = await app.request(callback, { headers: { cookie: 'adult_oauth=' + token } }, env)
    expect(first.headers.get('location')).toBe('/pricing?a=1|2')
    expect(sqlite.prepare('SELECT adult_declared_at, adult_declaration_version FROM users').get()).toEqual({ adult_declared_at: expect.any(String), adult_declaration_version: ADULT_DECLARATION_VERSION })
    const replay = await app.request(callback, { headers: { cookie: 'adult_oauth=' + token } }, env)
    expect(replay.headers.get('location')).toContain('adult_declaration_expired')
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 })
  })
})
