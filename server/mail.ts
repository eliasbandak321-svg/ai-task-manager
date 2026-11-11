import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Env } from './env'

/*
  Email delivery behind one small interface, so the provider can change without touching the
  auth code. Development transports only, for now (no paid services):
  - console: prints each email (with its link) in the API terminal
  - file:    writes each email as a JSON file into MAIL_DIR (the end-to-end tests read them)
  M11 adds a real provider (e.g. SMTP or an email API) as another Mailer implementation;
  production refuses to start until one is configured (server/env.ts).
*/

export interface Email {
  to: string
  subject: string
  text: string
  /** The one action link in the email (verification or password reset). */
  link?: string
}

export interface Mailer {
  send(email: Email): Promise<void>
}

export class ConsoleMailer implements Mailer {
  async send(email: Email): Promise<void> {
    console.log(`\n📧 Email to ${email.to}: ${email.subject}\n${email.text}\n`)
  }
}

export class FileMailer implements Mailer {
  private readonly dir: string
  private counter = 0

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }

  async send(email: Email): Promise<void> {
    this.counter += 1
    const name = `${Date.now()}-${process.pid}-${this.counter}.json`
    // Mode 600: these files contain sign-in links.
    writeFileSync(join(this.dir, name), JSON.stringify({ ...email, sentAt: new Date().toISOString() }, null, 2), {
      mode: 0o600,
    })
  }
}

/** Collects emails in memory (tests). */
export class MemoryMailer implements Mailer {
  readonly sent: Email[] = []

  async send(email: Email): Promise<void> {
    this.sent.push(email)
  }

  /** The most recent email to `to`, if any. */
  latestTo(to: string): Email | undefined {
    return this.sent.filter((email) => email.to === to).at(-1)
  }
}

export function createMailer(env: Pick<Env, 'MAIL_TRANSPORT' | 'MAIL_DIR'>): Mailer {
  return env.MAIL_TRANSPORT === 'file' ? new FileMailer(env.MAIL_DIR) : new ConsoleMailer()
}

// ---------- The emails ----------

export const emails = {
  verifyEmail: (to: string, link: string): Email => ({
    to,
    subject: 'Confirm your email address',
    link,
    text: `Welcome to AI Task Manager!\n\nConfirm your email address to activate your account:\n${link}\n\nThe link expires in 24 hours. If you didn't sign up, you can ignore this email.`,
  }),
  resetPassword: (to: string, link: string): Email => ({
    to,
    subject: 'Reset your password',
    link,
    text: `Someone (hopefully you) asked to reset your AI Task Manager password.\n\nChoose a new password here:\n${link}\n\nThe link expires in 15 minutes and works once. If you didn't ask for this, ignore this email; your password stays the same.`,
  }),
  existingAccountSignUp: (to: string, forgotPasswordLink: string): Email => ({
    to,
    subject: 'Someone tried to sign up with your email',
    link: forgotPasswordLink,
    text: `Someone tried to create an AI Task Manager account with this email address, but you already have one.\n\nIf it was you, just sign in. Forgot your password? Request a reset link here:\n${forgotPasswordLink}\n\nIf it wasn't you, you can ignore this email; nothing has changed.`,
  }),
}
