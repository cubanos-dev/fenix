'use client'

import { useState } from 'react'

export interface SignInScreenProps {
  showDevAuth?: boolean
  labels: {
    title: string
    description: string
    google: string
    github: string
  }
  onGoogleSignIn: () => void
  onGithubSignIn: () => void
  onEmailSignIn?: (email: string, password: string) => Promise<{ error?: string }>
}

export default function SignInScreen({
  showDevAuth = false,
  labels,
  onGoogleSignIn,
  onGithubSignIn,
  onEmailSignIn,
}: SignInScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
          <p className="text-sm text-muted-foreground">{labels.description}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onGoogleSignIn}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            {labels.google}
          </button>
          <button
            type="button"
            onClick={onGithubSignIn}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            {labels.github}
          </button>
        </div>
        {showDevAuth && onEmailSignIn && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Dev Login</span>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setError('')
                const result = await onEmailSignIn(email, password)
                if (result.error) setError(result.error)
              }}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@fenix.local"
                className="h-10 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <input
                type="password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-10 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign In
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
