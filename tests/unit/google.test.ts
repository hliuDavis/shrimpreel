import { DatabaseSync } from 'node:sqlite'
import { d1Shim, kvShim, migrate } from './d1-sqlite'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '#/server/app'
import { exchangeGoogleCode, googleAuthRedirect, verifyGoogleIdToken } from '#/server/google'
import { ApiError, base64Url } from '#/server/util'

const CLIENT_ID = 'client-id'
const config = { clientId: CLIENT_ID, clientSecret: 'client-secret', redirectUri: 'https://site.example/api/auth/google/callback' }
const env = { APP_ENV: 'development', SITE_URL: 'https://site.example', GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: 'client-secret' } as unknown as Env

let db: DatabaseSync
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  migrate(db)
  Object.assign(env, { DB: d1Shim(db), KV: kvShim(), ADMIN_EMAILS: '', SESSION_SECRET: 'test-secret-long-enough-for-adult-flow-tests' })
})

let keys: CryptoKeyPair
let jwk: JsonWebKey

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  jwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1' } as JsonWebKey
})

afterEach(() => {
  vi.restoreAllMocks()
  db.close()
})

const encode = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)))

async function idToken(claims: Record<string, unknown>) {
  const input = `${encode({ alg: 'RS256', kid: 'k1' })}.${encode({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 600,
    sub: 'sub-1',
    email: 'a@example.com',
    email_verified: true,
    ...claims,
  })}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(input))
  return `${input}.${base64Url(new Uint8Array(signature))}`
}

// JWKS 返回测试公钥；token 端点记录请求体并返回给定的 id_token
function mockGoogle(token?: string) {
  const tokenRequests: URLSearchParams[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.includes('/oauth2/v3/certs')) return Response.json({ keys: [jwk] })
    if (url.includes('oauth2.googleapis.com/token')) {
      tokenRequests.push(new URLSearchParams(String(init?.body)))
      return Response.json({ id_token: token })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
  return tokenRequests
}

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error instanceof ApiError ? error.code : error),
  )

describe('Google 授权码流程：PKCE 与 nonce', () => {
  it('授权地址带 S256 code_challenge 和 nonce，challenge 由 verifier 推出', async () => {
    const { url, verifier, nonce, state } = await googleAuthRedirect(config)
    const params = new URL(url).searchParams
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    expect(params.get('code_challenge')).toBe(base64Url(new Uint8Array(digest)))
    expect(params.get('code_challenge_method')).toBe('S256')
    expect(params.get('nonce')).toBe(nonce)
    expect(params.get('state')).toBe(state)
    // RFC 7636：verifier 43–128 个字符
    expect(verifier.length).toBeGreaterThanOrEqual(43)
  })

  it('换 token 时带上 code_verifier；id_token 里的 nonce 不一致就拒绝', async () => {
    const requests = mockGoogle(await idToken({ nonce: 'n-1' }))
    expect((await exchangeGoogleCode('code', config, { verifier: 'v-1', nonce: 'n-1' })).sub).toBe('sub-1')
    expect(requests[0]!.get('code_verifier')).toBe('v-1')
    expect(await rejection(exchangeGoogleCode('code', config, { verifier: 'v-1', nonce: 'n-2' }))).toBe('oauth_state')
  })

  it('id_token 没有 nonce、或期望值为空时拒绝', async () => {
    mockGoogle()
    expect(await rejection(verifyGoogleIdToken(await idToken({}), CLIENT_ID, 'n-1'))).toBe('oauth_state')
    expect(await rejection(verifyGoogleIdToken(await idToken({ nonce: '' }), CLIENT_ID, ''))).toBe('oauth_state')
    expect((await verifyGoogleIdToken(await idToken({ nonce: 'n-1' }), CLIENT_ID, 'n-1')).email).toBe('a@example.com')
  })

  it('成年声明后 start 把 OAuth 上下文存在服务端，cookie 只携带随机令牌', async () => {
    const res = await app.request('/api/auth/google/start', {
      method: 'POST', headers: { origin: 'https://site.example', 'content-type': 'application/json' },
      body: JSON.stringify({ adultConfirmed: true, redirect: '/pricing?a=1|2' }),
    }, env)
    expect(res.status).toBe(200)
    const { url } = await res.json() as { url: string }
    const cookie = res.headers.get('set-cookie') ?? ''
    const params = new URL(url).searchParams
    const flow = db.prepare('SELECT * FROM adult_oauth_flows').get()!
    expect(flow.oauth_state).toBe(params.get('state'))
    expect(flow.nonce).toBe(params.get('nonce'))
    expect(flow.verifier).toBeTruthy()
    expect(flow.redirect_path).toBe('/pricing?a=1|2')
    expect(cookie).toMatch(/adult_oauth=[A-Za-z0-9_-]{43}/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain(String(flow.verifier))
    expect(cookie).not.toContain('/pricing')
  })

  it('回调缺 verifier（旧版 cookie）时按登录过期处理，不去换 token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const res = await app.request('/api/auth/google/callback?state=s&code=c', { headers: { cookie: 'oauth_state=s|/dashboard' } }, env)
    expect(res.headers.get('location')).toContain('/sign-in?error=adult_declaration_expired')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('One Tap 已关闭', () => {
  it('nonce 与 credential 接口均拒绝，不能绕过成年声明', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const get = await app.request('/api/auth/google/nonce', {}, env)
    expect(get.status).toBe(404)
    const post = await app.request('/api/auth/google/one-tap', {
      method: 'POST', headers: { origin: 'https://site.example', 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'old-one-tap-token', adultConfirmed: true }),
    }, env)
    expect(post.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 })
  })
})
