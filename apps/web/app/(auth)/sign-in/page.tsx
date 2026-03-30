'use client'

import { signIn } from '@fenix/auth/client'
import { useTranslations } from 'next-intl'

export default function SignInPage() {
  const t = useTranslations('auth')

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t('signInTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('signInDescription')}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => signIn.social({ provider: 'google', callbackURL: '/dashboard' })}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            {t('signInWithGoogle')}
          </button>
          <button
            type="button"
            onClick={() => signIn.social({ provider: 'github', callbackURL: '/dashboard' })}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            {t('signInWithGithub')}
          </button>
        </div>
      </div>
    </div>
  )
}
