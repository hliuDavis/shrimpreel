import { createFileRoute } from '@tanstack/react-router'
import { Pricing } from '#/components/Pricing'
import { getContent, localeFromParam, pageHead, useContent } from '#/lib/i18n'
import { breadcrumbJsonLd, jsonLdScript } from '#/lib/seo'

export const Route = createFileRoute('/{-$locale}/pricing')({
  head: ({ params }) => {
    const locale = localeFromParam(params.locale)
    const c = getContent(locale)
    return {
      ...pageHead(locale, '/pricing', c.meta.pricingTitle, c.publicLayout.priceMeta),
      scripts: [jsonLdScript(breadcrumbJsonLd(locale, c.meta.breadcrumbHome, [{ name: c.nav.pricing, path: '/pricing' }]))],
    }
  },
  component: PricingPage,
})

function PricingPage() {
  const c = useContent()
  return (
    <div className="container-page public-pricing">
      <header className="public-page-heading">
        <p className="eyebrow">{c.publicLayout.priceEyebrow}</p>
        <h1>{c.publicLayout.priceTitle}</h1>
        <p>{c.publicLayout.priceIntro}</p>
      </header>
      <Pricing showSubscriptions={false} />
    </div>
  )
}
