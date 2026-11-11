import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test as base, expect, type Browser, type Page } from '@playwright/test'

/*
  Shared helpers for the end-to-end tests.

  Rate limiting stays ON in these tests (never weakened to make tests pass). Each test acts as
  its own client: it sends an X-Forwarded-For address that the Vite proxy forwards, and the
  API trusts it only because the request comes through that local proxy (TRUSTED_PROXIES).
*/

export const PASSWORD = 'correct horse battery staple'
const MAIL_DIR = join(process.env.E2E_RUN_DIR ?? '', 'mail')

let ipCounter = 0
/** A fresh documentation-range address (RFC 5737) per client, so limits don't collide. */
export function nextClientIp(): string {
  ipCounter += 1
  return `198.51.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`
}

let emailCounter = 0
export function uniqueEmail(name = 'user'): string {
  emailCounter += 1
  return `${name}-${Date.now()}-${emailCounter}@e2e.test`
}

export const test = base.extend({
  // Playwright reads fixture dependencies from this (empty) destructuring pattern.
  // oxlint-disable-next-line no-empty-pattern
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ 'X-Forwarded-For': nextClientIp() })
  },
})
export { expect }

/** A second, independent browser (another person, or the same person on another device). */
export async function newClient(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ ...options, extraHTTPHeaders: { 'X-Forwarded-For': nextClientIp() } })
  return { context, page: await context.newPage() }
}

interface StoredEmail {
  to: string
  subject: string
  text: string
  link?: string
}

function emailsTo(to: string): StoredEmail[] {
  let files: string[] = []
  try {
    files = readdirSync(MAIL_DIR).sort()
  } catch {
    return []
  }
  return files
    .map((file) => JSON.parse(readFileSync(join(MAIL_DIR, file), 'utf8')) as StoredEmail)
    .filter((email) => email.to === to)
}

/** Waits for the next email to `to` with `subject` (after `previousCount` such emails). */
export async function waitForEmail(to: string, subject: string, previousCount = 0): Promise<StoredEmail> {
  let found: StoredEmail | undefined
  await expect
    .poll(() => {
      const matching = emailsTo(to).filter((email) => email.subject === subject)
      found = matching.length > previousCount ? matching.at(-1) : undefined
      return Boolean(found)
    }, { message: `email "${subject}" to ${to}` })
    .toBe(true)
  return found as StoredEmail
}

export function countEmails(to: string, subject?: string): number {
  return emailsTo(to).filter((email) => subject === undefined || email.subject === subject).length
}

export async function fillSignUp(page: Page, { name, email, password = PASSWORD }: { name: string; email: string; password?: string }) {
  await page.goto('/signup')
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible()
}

/** Signs up through the UI and confirms the email via the link; ends signed in on /app. */
export async function signUpAndConfirm(page: Page, name = 'E2E User', email = uniqueEmail()) {
  await fillSignUp(page, { name, email })
  const mail = await waitForEmail(email, 'Confirm your email address')
  await page.goto(mail.link ?? '')
  await expect(page.getByRole('heading', { level: 1, name: 'Email confirmed' })).toBeVisible()
  await page.getByRole('link', { name: 'Go to your tasks' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()
  return { email }
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export async function signOut(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
}
