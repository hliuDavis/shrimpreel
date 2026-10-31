import { ApiError, randomToken, sha256Hex } from './util'

// 修改声明含义时更新版本。只记录声明，不采集出生日期、证件或年龄估算。
export const ADULT_DECLARATION_VERSION = '18-and-local-majority-v1'
export const ADULT_FLOW_TTL_SECONDS = 600

export interface AdultDeclaration {
  declaredAt: string
  version: string
}

export function adultDeclaration(confirmed: unknown, now = new Date()): AdultDeclaration {
  if (confirmed !== true) throw new ApiError(400, 'adult_declaration_required')
  return { declaredAt: now.toISOString(), version: ADULT_DECLARATION_VERSION }
}

export function assertAdultDeclaration(value: AdultDeclaration | undefined) {
  const timestamp = value ? Date.parse(value.declaredAt) : NaN
  if (!value || value.version !== ADULT_DECLARATION_VERSION || !Number.isFinite(timestamp) || timestamp > Date.now() + 30_000) {
    throw new ApiError(400, 'adult_declaration_required')
  }
}

export function adultFlowCookie(production: boolean) {
  return production ? '__Host-adult-oauth' : 'adult_oauth'
}

interface OAuthContext {
  state: string
  verifier: string
  nonce: string
  redirect: string
}

interface StoredFlow {
  verifier: string
  nonce: string
  redirect_path: string
  declared_at: string
  declaration_version: string
}

export async function clearExpiredAdultFlows(db: D1Database, now = new Date()) {
  await db.prepare('DELETE FROM adult_oauth_flows WHERE expires_at <= ?').bind(now.toISOString()).run()
}

export async function beginAdultFlow(db: D1Database, declaration: AdultDeclaration, oauth: OAuthContext) {
  assertAdultDeclaration(declaration)
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + ADULT_FLOW_TTL_SECONDS * 1000).toISOString()
  await db.batch([
    db.prepare('DELETE FROM adult_oauth_flows WHERE expires_at <= ?').bind(new Date().toISOString()),
    db.prepare('INSERT INTO adult_oauth_flows (token_hash, oauth_state, verifier, nonce, redirect_path, declared_at, declaration_version, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(await sha256Hex(token), oauth.state, oauth.verifier, oauth.nonce, oauth.redirect, declaration.declaredAt, declaration.version, expiresAt),
  ])
  return token
}

// 正确 cookie + 本次 state + 未过期才消费；一条 SQL 保证并发回调只有一个成功。
// 在访问 Google 或创建用户之前执行。失败后重新声明登录，不复用已消费的记录。
export async function consumeAdultFlow(db: D1Database, token: string | undefined, state: string, now = new Date()) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !state) throw new ApiError(400, 'adult_declaration_expired')
  const flow = await db.prepare('DELETE FROM adult_oauth_flows WHERE token_hash = ? AND oauth_state = ? AND expires_at > ? AND declaration_version = ? RETURNING verifier, nonce, redirect_path, declared_at, declaration_version')
    .bind(await sha256Hex(token), state, now.toISOString(), ADULT_DECLARATION_VERSION)
    .first<StoredFlow>()
  if (!flow) throw new ApiError(400, 'adult_declaration_expired')
  return {
    verifier: flow.verifier,
    nonce: flow.nonce,
    redirect: flow.redirect_path,
    declaration: { declaredAt: flow.declared_at, version: flow.declaration_version } satisfies AdultDeclaration,
  }
}
