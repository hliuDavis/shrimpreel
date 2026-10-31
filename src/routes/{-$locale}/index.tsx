import { createFileRoute } from '@tanstack/react-router'
import { Generator } from '#/components/Generator'
import { VideoCard } from '#/components/VideoCard'
import { defaultStyle, findStyle, site } from '#/config/site'
import { getContent, localeFromParam, pageHead, useContent } from '#/lib/i18n'
import { homeJsonLd, jsonLdScript } from '#/lib/seo'

export const Route = createFileRoute('/{-$locale}/')({
  validateSearch: (search: Record<string, unknown>): { style?: string } => ({
    style: typeof search.style === 'string' && findStyle(search.style) ? search.style : undefined,
  }),
  head: ({ params }) => {
    const locale = localeFromParam(params.locale)
    const c = getContent(locale)
    return {
      ...pageHead(locale, '/', c.meta.homeTitle, c.meta.homeDescription),
      // FAQ 已移到 Guide：结构化数据必须和当前页面可见内容对应。
      scripts: [jsonLdScript(homeJsonLd(locale, c.meta.homeDescription, { name: c.hero.aiVersion + ' – ' + site.keyword, description: c.madeWith.body }))],
    }
  },
  component: Home,
})

function Home() {
  const c = useContent()
  const { style: styleId } = Route.useSearch()
  // 保留旧 style 深链接；界面不再提供风格选择，未指定时使用默认模板。
  const style = (styleId && findStyle(styleId)) || defaultStyle
  return (
    <div className="container-page public-create">
      <header className="public-intro">
        <p className="eyebrow">{c.publicLayout.createEyebrow} / {site.keyword}</p>
        <h1>{c.hero.title}</h1>
        <p>{c.hero.subtitle}</p>
      </header>
      <div className="public-create-grid">
        <div id="create" className="scroll-mt-24">
          <Generator styleId={style.id} showStyleSelector={false} />
        </div>
        <section className="public-example card" id="examples">
          <div className="public-example-heading">
            <h2>{c.publicLayout.exampleTitle}</h2>
            <span className="chip">{c.styles[style.id as keyof typeof c.styles]?.name ?? site.keyword}</span>
          </div>
          <div className="public-example-videos">
            <VideoCard key={style.id + '-original'} video={style.examples.original.video} poster={style.examples.original.poster} label={c.hero.original} credit={style.examples.original.credit} />
            {style.examples.aiVersions.slice(0, 1).map((v) => (
              <VideoCard key={v.video} video={v.video} poster={v.poster} label={c.hero.aiVersion} credit={v.credit} />
            ))}
          </div>
          <div className="public-example-note"><p>{c.hero.creditNote}</p><p>{c.publicLayout.exampleNote}</p></div>
        </section>
      </div>
    </div>
  )
}
