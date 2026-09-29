/**
 * Vercel Edge Middleware — skyddar kolonin.roost.love med admin-cookie.
 *
 * Flöde:
 *   ?token=X  → validera mot ROOST_ADMIN_TOKEN → sätt cookie → redirect till ren URL
 *   cookie OK → pass through
 *   inget     → visa inloggningsformulär (HTTP 401)
 *
 * API-rutter (/api/*) och statiska assets (/assets/*) körs utan middleware.
 */
export const config = {
  matcher: ['/((?!api/|assets/|public/|_vercel).*)'],
}

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kolonin — logga in</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0c1830;color:#93c5fd;display:flex;align-items:center;justify-content:center;min-height:100vh}
  form{background:rgba(255,255,255,.05);padding:2rem;border-radius:1rem;border:1px solid rgba(147,197,253,.2);width:min(320px,90vw)}
  h1{font-size:1.1rem;margin-bottom:1.25rem;letter-spacing:.05em}
  input{width:100%;padding:.5rem .75rem;background:rgba(255,255,255,.08);border:1px solid rgba(147,197,253,.3);border-radius:.5rem;color:#e2e8f0;font-family:monospace;font-size:.95rem}
  button{margin-top:1rem;width:100%;padding:.6rem;background:#93c5fd;color:#0c1830;border:none;border-radius:.5rem;font-weight:700;cursor:pointer;font-size:.95rem}
  button:hover{background:#bfdbfe}
</style>
</head>
<body>
<form method="get" action="">
  <h1>Kolonin</h1>
  <input name="token" type="password" placeholder="Admin-token" autocomplete="current-password" autofocus>
  <button type="submit">Logga in</button>
</form>
</body>
</html>`

export default function middleware(request) {
  const envToken = process.env.ROOST_ADMIN_TOKEN
  if (!envToken) {
    return new Response('ROOST_ADMIN_TOKEN saknas i servermiljön', { status: 500 })
  }

  const url = new URL(request.url)

  // Token i URL → validera, sätt cookie, redirect till ren URL
  const urlToken = url.searchParams.get('token')
  if (urlToken) {
    if (urlToken !== envToken) {
      return new Response(LOGIN_HTML, {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
    url.searchParams.delete('token')
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': `roost_admin_token=${envToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
      },
    })
  }

  // Cookie-kontroll
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)roost_admin_token=([^;]+)/)
  if (match && match[1] === envToken) {
    return // pass through
  }

  // Ingen giltig autentisering → inloggningssida
  return new Response(LOGIN_HTML, {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
