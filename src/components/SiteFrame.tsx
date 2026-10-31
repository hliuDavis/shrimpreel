import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { stripLocale } from '#/lib/i18n'
import { Footer, SupportButton } from './Footer'
import { Nav } from './Nav'
import { SiteNotice } from './SiteNotice'

// 用户端统一外框：普通路由、404 和错误页共享主题、导航、主区域和页脚。
// public-site 仅控制三个营销／创作页面的内部样式，不决定外框是否使用新主题。
export function SiteFrame({ children, showNotice = false }: { children: ReactNode; showNotice?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const publicView = ['/', '/guides', '/pricing'].includes(stripLocale(pathname).replace(/\/$/, '') || '/')
  return (
    <div className={publicView ? 'customer-site public-site' : 'customer-site'} data-testid="site-frame">
      {showNotice ? <SiteNotice /> : null}
      <Nav />
      <main className="site-main">{children}</main>
      <Footer />
      <SupportButton />
    </div>
  )
}
