import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
  vercel.json deploys the static portfolio demo (M11); tested here because this project has Node. It must stay in step with the code: the
  CSP allows exactly the inline theme script in index.html (by hash) and forbids every network
  request, and every app route is served the single-page app.
*/

interface VercelConfig {
  buildCommand: string
  outputDirectory: string
  functions?: unknown
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig
const headers = Object.fromEntries(vercel.headers[0].headers.map(({ key, value }) => [key, value]))
const csp = headers['Content-Security-Policy']
const directive = (name: string) => csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `))

describe('vercel.json (static demo deployment)', () => {
  it('builds the demo, with no server functions', () => {
    expect(vercel.buildCommand).toBe('npm run build:demo')
    expect(vercel.outputDirectory).toBe('dist-demo')
    expect(vercel.functions).toBeUndefined()
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts['build:demo']).toContain('VITE_DEMO=1')
  })

  it('forbids every network request from the page, and allows only the known inline script', () => {
    expect(directive('connect-src')).toBe("connect-src 'none'")
    const inline = [...readFileSync('index.html', 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    expect(inline).toHaveLength(1)
    const hash = `sha256-${createHash('sha256').update(inline[0]).digest('base64')}`
    expect(directive('script-src')).toBe(`script-src 'self' '${hash}'`)
    for (const rule of ["object-src 'none'", "frame-ancestors 'none'", "form-action 'none'", "base-uri 'self'"]) expect(csp).toContain(rule)
  })

  it('sends the basic security headers', () => {
    expect(headers).toMatchObject({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d{8}/)
  })

  it('serves the app for every route except built assets', () => {
    const route = (path: string) => vercel.rewrites.find((rewrite) => new RegExp(`^${rewrite.source}$`).test(path))?.destination
    for (const path of ['/', '/app', '/app/calendar', '/login', '/privacy']) expect(route(path)).toBe('/index.html')
    expect(route('/assets/index-abc.js')).toBeUndefined()
  })
})
