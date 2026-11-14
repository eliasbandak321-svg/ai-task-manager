import type { Page } from '@playwright/test'
import { expect, signUpAndConfirm, test } from './support'

/*
  Layout regression: on every signed-in page the page title (h1) is fully visible below the
  sticky header and main navigation — at the top, after navigating, and when keyboard focus
  moves to the main region. Screenshots go to test-results/layout/ for visual review.
*/

const PAGES = [
  { link: 'Dashboard', heading: 'Dashboard' },
  { link: 'Calendar', heading: 'Calendar' },
  { link: 'Projects', heading: 'All tasks' },
  { link: 'AI Assistant', heading: /AI Assistant/ },
  { link: 'Insights', heading: 'Insights' },
  { link: 'Settings', heading: 'Settings' },
] as const

/** Waits until smooth scrolling has finished (the scroll position stops changing). */
async function scrollSettled(page: Page): Promise<void> {
  let previous = -1
  for (let i = 0; i < 40; i += 1) {
    const current = await page.evaluate(() => scrollY)
    if (current === previous) return
    previous = current
    await page.waitForTimeout(100)
  }
}

async function headerBottom(page: Page): Promise<number> {
  return page.getByRole('banner').evaluate((element) => element.getBoundingClientRect().bottom)
}

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`page titles are never hidden under the header (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await signUpAndConfirm(page, 'Layout Tester')
    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const { link, heading } of PAGES) {
      await nav.getByRole('link', { name: link }).click()
      const title = page.getByRole('heading', { level: 1, name: heading })
      await expect(title).toBeVisible()
      // Let focus management and scrolling settle.
      await page.waitForTimeout(150)
      const box = await title.boundingBox()
      expect(box, `${link}: title has a box`).not.toBeNull()
      expect(box!.y, `${link}: title starts below the header`).toBeGreaterThanOrEqual(await headerBottom(page))
      await page.screenshot({ path: `test-results/layout/${viewport.name}-${link.replace(/\s/g, '-').toLowerCase()}.png` })
    }

    // New answers scroll the conversation panel, never the page. (Typing may scroll the page
    // to the message box — Playwright does that too — but an arriving answer must not.)
    await nav.getByRole('link', { name: 'AI Assistant' }).click()
    const message = page.getByRole('textbox', { name: 'Message' })
    for (const text of ['What should I focus on?', 'What is due this week?', 'How am I doing?']) {
      await message.fill(text)
      await scrollSettled(page)
      const before = await page.evaluate(() => scrollY)
      await message.press('Enter')
      await expect(page.getByText('Thinking…')).toBeHidden()
      await scrollSettled(page)
      expect(await page.evaluate(() => scrollY), 'an answer does not scroll the page').toBe(before)
    }
    await page.screenshot({ path: `test-results/layout/${viewport.name}-assistant-after-chat.png` })
    if (viewport.name === 'desktop') {
      const assistantTitle = await page.getByRole('heading', { level: 1, name: /AI Assistant/ }).boundingBox()
      expect(assistantTitle!.y, 'assistant title stays below the header after chatting').toBeGreaterThanOrEqual(await headerBottom(page))
    }

    // "Skip to content" from a scrolled page lands with the title visible below the header.
    await nav.getByRole('link', { name: 'Calendar' }).click()
    await page.mouse.wheel(0, 600)
    await scrollSettled(page)
    await page.evaluate(() => (document.querySelector('a[href="#main"]') as HTMLAnchorElement).click())
    await scrollSettled(page)
    const main = await page.locator('#main').boundingBox()
    expect(main!.y, 'main starts below the header after skip link').toBeGreaterThanOrEqual((await headerBottom(page)) - 1)
  })
}
