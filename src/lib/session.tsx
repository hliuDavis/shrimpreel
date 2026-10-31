import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type ClientConfig, type PublicUser } from './api'
import { site } from '#/config/site'
import { captureAttribution, track } from './attribution'

type SessionState = {
  user: PublicUser | null
  config: ClientConfig | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

// 会话只在浏览器端加载（/api/me），SSR 输出未登录态，保证页面可缓存、SEO 稳定
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: PublicUser | null; config: ClientConfig }>('/api/me')
      setUser(data.user)
      setConfig(data.config)
    } catch (error) {
      console.error('session load failed', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST', json: {} })
    setUser(null)
  }, [])

  useEffect(() => {
    captureAttribution(!!site.analytics.ga4Id)
    void refresh()
  }, [refresh])

  // 新账号（创建 10 分钟内）首次出现时上报 GA4 sign_up；OAuth 跳转和 dev 登录都会走到这里
  useEffect(() => {
    if (!user || Date.now() - Date.parse(user.createdAt) > 10 * 60_000) return
    try {
      if (localStorage.getItem(`signup:${user.id}`)) return
      localStorage.setItem(`signup:${user.id}`, '1')
    } catch {
      return
    }
    track('sign_up', { method: config?.googleClientId ? 'google' : 'dev' })
  }, [user, config])

  const value = useMemo(() => ({ user, config, loading, refresh, signOut }), [user, config, loading, refresh, signOut])
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

// 所有登录入口先经过成年声明页，不能直接跳过页面进入 OAuth。
export function signInHref(_config: ClientConfig | null, redirect: string, signInPath: string) {
  return signInPath + '?redirect=' + encodeURIComponent(redirect)
}
