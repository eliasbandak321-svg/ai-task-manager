/*
  After signing in, the user returns to the page they wanted (/login?next=/app/projects/…).
  `next` comes from the URL, so it's untrusted: only paths inside the app are accepted.
  Anything else — another site (https://evil.example, //evil.example), a backslash trick or a
  non-app page — falls back to /app. This prevents "open redirect" phishing links.
*/

export const DEFAULT_AFTER_LOGIN = '/app'

export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_AFTER_LOGIN
  const isAppPath = next === '/app' || next.startsWith('/app/') || next.startsWith('/app?')
  if (!isAppPath || next.includes('\\') || next.includes('//')) return DEFAULT_AFTER_LOGIN
  return next
}

/** The login URL that returns to `path` afterwards. */
export function loginPathFor(path: string): string {
  const next = safeNextPath(path)
  return next === DEFAULT_AFTER_LOGIN ? '/login' : `/login?next=${encodeURIComponent(next)}`
}
