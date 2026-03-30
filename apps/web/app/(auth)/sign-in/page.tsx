'use client'

import { signIn } from '@fenix/auth/client'
import { useTranslations } from 'next-intl'
import SignInScreen from './_components/screen'

const showDevAuth = process.env.NODE_ENV === 'development'
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
const callbackURL = `${appUrl}/dashboard`

export default function SignInPage() {
  const t = useTranslations('auth')

  return (
    <SignInScreen
      showDevAuth={showDevAuth}
      labels={{
        title: t('signInTitle'),
        description: t('signInDescription'),
        google: t('signInWithGoogle'),
        github: t('signInWithGithub'),
      }}
      onGoogleSignIn={() => signIn.social({ provider: 'google', callbackURL })}
      onGithubSignIn={() => signIn.social({ provider: 'github', callbackURL })}
      onEmailSignIn={async (email, password) => {
        const result = await signIn.email({ email, password, callbackURL })
        if (result.error) return { error: result.error.message ?? 'Sign in failed' }
        return {}
      }}
    />
  )
}
