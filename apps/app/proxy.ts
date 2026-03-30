import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@fenix/auth'

const publicPaths = ['/api/auth']

function isPublicPath(pathname: string) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'
    const signInUrl = new URL('/sign-in', webUrl)
    signInUrl.searchParams.set('redirect', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
