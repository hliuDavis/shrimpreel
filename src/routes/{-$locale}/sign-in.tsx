import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { ErrorText, GoogleIcon, LocalLink, LogoMark, Spinner } from '#/components/ui'
import { api, errorCode } from '#/lib/api'
import { getContent, localeFromParam, pageHead, useContent, useLocalePath } from '#/lib/i18n'
import { safeRedirectPath } from '#/lib/redirect'
import { useSession } from '#/lib/session'

type Search = { redirect?: string; error?: string }

export const Route = createFileRoute('/{-$locale}/sign-in')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  head: ({ params }) => {
    const locale = localeFromParam(params.locale)
    const c = getContent(locale)
    const head = pageHead(locale, '/sign-in', c.meta.signInTitle, c.signIn.body)
    return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex' }] }
  },
  component: SignInPage,
})

function SignInPage() {
  const c = useContent()
  const t = c.signIn
  const lp = useLocalePath()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { user, config, loading, refresh } = useSession()
  const redirect = safeRedirectPath(search.redirect, lp('/dashboard'))
  const [email, setEmail] = useState('demo@example.com')
  const [pending, setPending] = useState(false)
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(search.error ?? null)

  useEffect(() => {
    if (user) void navigate({ href: redirect })
  }, [user, redirect, navigate])

  async function devLogin(event: FormEvent) {
    event.preventDefault()
    if (!adultConfirmed) return setError('adult_declaration_required')
    setPending(true)
    setError(null)
    try {
      await api('/api/auth/dev-login', { json: { email, adultConfirmed } })
      await refresh()
    } catch (err) {
      setError(errorCode(err))
    } finally {
      setPending(false)
    }
  }

  async function googleLogin() {
    if (!adultConfirmed) return setError('adult_declaration_required')
    setPending(true)
    setError(null)
    try {
      const { url } = await api<{ url: string }>('/api/auth/google/start', { json: { adultConfirmed, redirect } })
      window.location.assign(url)
    } catch (err) {
      setError(errorCode(err))
      setPending(false)
    }
  }

  return (
    <div className="container-page grid max-w-md place-items-center py-20">
      <div className="card w-full space-y-6 p-8 text-center">
        <LogoMark className="mx-auto size-12 text-base" />
        <div className="space-y-2">
          <h1 className="font-display text-3xl">{t.title}</h1>
          <p className="text-sm text-muted">{t.body}</p>
        </div>
        <label className="flex items-start gap-3 text-left text-sm leading-6">
          <input
            type="checkbox"
            checked={adultConfirmed}
            onChange={(event) => setAdultConfirmed(event.target.checked)}
            disabled={pending}
            className="mt-1 size-4 shrink-0 accent-[var(--ink)]"
            data-testid="adult-declaration"
          />
          <span>{t.adultDeclaration}</span>
        </label>
        <p className="text-left text-xs text-muted">{t.adultDeclarationNote}</p>
        {loading ? (
          <Spinner className="mx-auto size-5" />
        ) : config?.googleClientId ? (
          <button type="button" onClick={googleLogin} disabled={pending || !adultConfirmed} className="btn-primary w-full py-3.5" data-testid="google-login">
            {pending ? <Spinner /> : <GoogleIcon />} {t.google}
          </button>
        ) : (
          <p className="text-sm text-muted">{t.notConfigured}</p>
        )}
        {config?.devLogin ? (
          <form onSubmit={devLogin} className="space-y-3 border-t border-line pt-6 text-left">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t.devTitle}</p>
            <label className="block space-y-1.5 text-sm">
              <span>{t.devEmail}</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="dev-email" />
            </label>
            <button type="submit" className="btn-ghost w-full" disabled={pending || !adultConfirmed} data-testid="dev-login">
              {pending ? <Spinner /> : null} {t.devSubmit}
            </button>
          </form>
        ) : null}
        <ErrorText code={error} />
        <p className="text-xs text-muted">
          <LocalLink to="/terms-of-service" className="underline">
            {t.legal}
          </LocalLink>
        </p>
      </div>
    </div>
  )
}
