import { LifeBuoy } from 'lucide-react'
import { site } from '#/config/site'
import { CONSENT_OPEN_EVENT } from '#/lib/consent'
import { useContent } from '#/lib/i18n'
import { LocalLink } from './ui'

// 所有用户页面共用同一个页脚，不再按 URL 切换旧版深色布局。
export function Footer() {
  const c = useContent()
  return (
    <footer className="public-footer" data-testid="site-footer">
      <div className="container-page">
        <span>{c.footer.rights}</span>
        <div>
          <LocalLink to="/contact">{c.footer.contact}</LocalLink>
          <LocalLink to="/privacy-policy">{c.footer.privacy}</LocalLink>
          <LocalLink to="/terms-of-service">{c.footer.terms}</LocalLink>
          <LocalLink to="/refund-policy">{c.footer.refund}</LocalLink>
          <LocalLink to="/report">{c.footer.report}</LocalLink>
          {site.analytics.ga4Id ? (
            <button type="button" onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
              {c.consent.settings}
            </button>
          ) : null}
        </div>
      </div>
    </footer>
  )
}

export function SupportButton() {
  const c = useContent()
  return (
    <LocalLink
      to="/contact"
      aria-label={c.support.label}
      title={c.support.label}
      className="fixed right-5 bottom-5 z-30 grid size-12 place-items-center rounded-full bg-ink text-ink-fg shadow-lg transition hover:scale-105"
    >
      <LifeBuoy className="size-5" />
    </LocalLink>
  )
}
