/**
 * Vercel Edge Middleware — skyddar kolonin.roost.love med admin-cookie.
 *
 * Flöde:
 *   ?token=X  → validera mot ROOST_ADMIN_TOKEN → sätt cookie → redirect till ren URL
 *   cookie OK → pass through
 *   inget     → redirect till roost.love/admin/login?return=<aktuell-URL>
 *
 * API-rutter (/api/*) och statiska assets (/assets/*) körs utan middleware.
 */
export const config = {
  matcher: ['/((?!api/|assets/|public/|_vercel).*)'],
}

export default function middleware(request) {
  const envToken = process.env.ROOST_ADMIN_TOKEN
  if (!envToken) {
    return new Response('ROOST_ADMIN_TOKEN saknas i servermiljön', { status: 500 })
  }

  const url = new URL(request.url)

  // Token i URL → validera, sätt cookie, redirect till ren URL
  // Fallback tills roostadmin sätter Domain=.roost.love cookie vid inloggning
  const urlToken = url.searchParams.get('token')
  if (urlToken) {
    if (urlToken !== envToken) {
      const loginUrl = new URL('https://roost.love/admin/login')
      loginUrl.searchParams.set('return', request.url)
      return new Response(null, {
        status: 302,
        headers: { Location: loginUrl.toString() },
      })
    }
    url.searchParams.delete('token')
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': `roost_admin_token=${envToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=.roost.love; Max-Age=604800`,
      },
    })
  }

  // Cookie-kontroll
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)roost_admin_token=([^;]+)/)
  if (match && match[1] === envToken) {
    return // pass through
  }

  // Ingen giltig autentisering → skicka till Roostadmin-inloggningen med retur-URL
  const loginUrl = new URL('https://roost.love/admin/login')
  loginUrl.searchParams.set('return', request.url)
  return new Response(null, {
    status: 302,
    headers: { Location: loginUrl.toString() },
  })
}
