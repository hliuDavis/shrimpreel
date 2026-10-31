import { createFileRoute } from '@tanstack/react-router'
import { Check, Minus } from 'lucide-react'
import { ArticleCards } from '#/components/ArticleCards'
import { Faq, faqJsonLd } from '#/components/Faq'
import { LocalLink } from '#/components/ui'
import { ARTICLES } from '#/config/site'
import { getContent, localeFromParam, pageHead, useContent } from '#/lib/i18n'
import { breadcrumbJsonLd, jsonLdScript } from '#/lib/seo'

export const Route = createFileRoute('/{-$locale}/guides')({
  head: ({ params }) => {
    const locale = localeFromParam(params.locale)
    const c = getContent(locale)
    return {
      ...pageHead(locale, '/guides', c.guides.metaTitle, c.publicLayout.guideMeta),
      scripts: [
        jsonLdScript(breadcrumbJsonLd(locale, c.meta.breadcrumbHome, [{ name: c.publicLayout.guide, path: '/guides' }])),
        jsonLdScript(faqJsonLd(c.faq.items)),
      ],
    }
  },
  component: GuidesPage,
})

function GuidesPage() {
  const c = useContent()
  return (
    <div className="container-page public-guide">
      <header className="public-page-heading">
        <p className="eyebrow">{c.publicLayout.guideEyebrow}</p>
        <h1>{c.publicLayout.guideTitle}</h1>
        <p>{c.publicLayout.guideIntro}</p>
      </header>
      <ol className="public-steps">
        {c.howTo.steps.map((step, i) => (
          <li key={step.title} className="card"><span className="public-step-number">{'0' + (i + 1)}</span><h2>{step.title}</h2><p>{step.body}</p></li>
        ))}
      </ol>
      <div className={'public-guide-columns' + (c.withWithout ? '' : ' public-guide-single')}>
        <section className="public-guide-about">
          <p className="eyebrow">{c.publicLayout.aboutEyebrow}</p>
          <h2>{c.publicLayout.aboutTitle}</h2>
          {c.publicLayout.aboutParagraphs.map((text) => <p key={text}>{text}</p>)}
          <p className="public-disclaimer">{c.publicLayout.exampleNote}</p>
          <LocalLink to="/" className="btn-primary">{c.publicLayout.create}</LocalLink>
        </section>
        {c.withWithout ? (
          <section className="public-comparison">
            <p className="eyebrow">{c.withWithout.eyebrow}</p>
            <h2>{c.withWithout.title}</h2>
            <div className="card">
              <table>
                <thead><tr><th scope="col">{c.withWithout.without}</th><th scope="col">{c.withWithout.with}</th></tr></thead>
                <tbody>{c.withWithout.rows.map((row) => (
                  <tr key={row.with}><td><span><Minus aria-hidden="true" />{row.without}</span></td><td><span><Check aria-hidden="true" />{row.with}</span></td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
      <section className="public-guide-faq"><Faq /></section>
      {/* 保留旧文章入口，正文路由和收录地址不因布局调整而删除。 */}
      <details className="public-more-guides"><summary>{c.publicLayout.moreGuides}</summary><ArticleCards articles={ARTICLES} headingLevel={2} /></details>
    </div>
  )
}
