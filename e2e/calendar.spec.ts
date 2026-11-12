import type { Locator, Page } from '@playwright/test'
import { expect, signUpAndConfirm, test } from './support'

/*
  The calendar in a real browser, used like a person would: views, selecting a time range,
  dragging, resizing, repeating events and persistence. The device is in New York while the
  user's settings say Berlin: the calendar must show and save Berlin times.
  Screenshots go to test-results/ for visual review.
*/

test.use({ timezoneId: 'America/New_York', viewport: { width: 1280, height: 1000 } })

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/calendar/${name}.png`, fullPage: true })

function berlinDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

async function box(locator: Locator) {
  const value = await locator.boundingBox()
  if (!value) throw new Error('element not visible')
  return value
}

/** Drags with real mouse events (FullCalendar needs intermediate moves and a short pause). */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * step) / 10, from.y + ((to.y - from.y) * step) / 10)
    await page.waitForTimeout(20)
  }
  await page.mouse.up()
}

test('calendar views, select, drag, resize, repeating events and reload, in the user’s time zone', async ({ page }) => {
  await signUpAndConfirm(page, 'Calendar Tester')
  const nav = page.getByRole('navigation', { name: 'Main' })

  // Settings: Berlin, while the device says New York.
  await nav.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('combobox', { name: 'Time zone' }).selectOption('Europe/Berlin')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Settings saved.')).toBeVisible()

  await nav.getByRole('link', { name: 'Calendar' }).click()
  await expect(page.getByText('Times are shown in')).toContainText('Europe/Berlin')
  await expect(page.getByText('Your device is set to America/New_York.')).toBeVisible()

  // Views.
  const calendar = page.locator('.calendar-theme')
  await expect(calendar.locator('.fc-timeGridWeek-view')).toBeVisible()
  await calendar.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(calendar.locator('.fc-dayGridMonth-view')).toBeVisible()
  await shot(page, '01-month')
  await calendar.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(calendar.locator('.fc-timeGridWeek-view')).toBeVisible()
  await calendar.getByRole('button', { name: 'Day', exact: true }).click()
  await expect(calendar.locator('.fc-timeGridDay-view')).toBeVisible()
  // Tomorrow (Berlin), so nothing is in the past.
  await calendar.getByRole('button', { name: /next/i }).click()
  const tomorrow = berlinDate(1)
  const column = calendar.locator(`.fc-timegrid-col[data-date="${tomorrow}"]`)
  await expect(column).toBeVisible()
  await shot(page, '02-day')

  // Select 10:00–11:00 → the dialog opens with those Berlin times.
  const x = (await box(column)).x + (await box(column)).width / 2
  const slot = (time: string) => calendar.locator(`.fc-timegrid-slot-lane[data-time="${time}"]`)
  const at = async (time: string) => (await box(slot(time))).y + 4
  await drag(page, { x, y: await at('10:00:00') }, { x, y: await at('10:30:00') + 10 })
  const dialog = page.getByRole('dialog', { name: 'New event' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Starts')).toHaveValue(`${tomorrow}T10:00`)
  await expect(dialog.getByLabel('Ends')).toHaveValue(`${tomorrow}T11:00`)
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Deep work')
  await dialog.getByRole('combobox', { name: 'Category' }).selectOption('focus')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  const agenda = page.getByRole('region', { name: 'Agenda' })
  await expect(agenda.getByText('10:00–11:00')).toBeVisible()
  await shot(page, '03-selected')

  // Drag it one hour later.
  const event = calendar.locator('.fc-event', { hasText: 'Deep work' })
  const eventBox = await box(event)
  const hour = (await at('11:00:00')) - (await at('10:00:00'))
  await drag(page, { x: eventBox.x + eventBox.width / 2, y: eventBox.y + 10 }, { x: eventBox.x + eventBox.width / 2, y: eventBox.y + 10 + hour })
  await expect(page.getByText('Event updated.')).toBeVisible()
  await expect(agenda.getByText('11:00–12:00')).toBeVisible()

  // Resize: drag the bottom edge down by half an hour.
  await event.hover()
  const resizer = event.locator('.fc-event-resizer-end')
  const edge = await box(resizer)
  await drag(page, { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 }, { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 + hour / 2 })
  await expect(agenda.getByText('11:00–12:30')).toBeVisible()
  await shot(page, '04-moved-resized')

  // A daily repeating event; moving one occurrence asks which ones to change.
  await page.getByRole('button', { name: 'New event' }).click()
  const repeat = page.getByRole('dialog', { name: 'New event' })
  await repeat.getByRole('textbox', { name: 'Title' }).fill('Standup')
  await repeat.getByLabel('Starts').fill(`${tomorrow}T08:00`)
  await repeat.getByLabel('Ends').fill(`${tomorrow}T08:30`)
  await repeat.getByRole('combobox', { name: 'Category' }).selectOption('meeting')
  await repeat.getByRole('combobox', { name: 'Repeats' }).selectOption('daily')
  await repeat.getByRole('button', { name: 'Save' }).click()
  await expect(repeat).toBeHidden()
  const standup = calendar.locator('.fc-event', { hasText: 'Standup' })
  await expect(standup).toBeVisible()
  const standupBox = await box(standup)
  await drag(page, { x: standupBox.x + standupBox.width / 2, y: standupBox.y + 8 }, { x: standupBox.x + standupBox.width / 2, y: standupBox.y + 8 + hour })
  const scope = page.getByRole('dialog', { name: 'Move "Standup"' })
  await expect(scope).toBeVisible()
  await scope.getByRole('button', { name: 'Only this event' }).click()
  await expect(agenda.getByText('09:00–09:30')).toBeVisible()
  // The next day keeps 08:00.
  await calendar.getByRole('button', { name: /next/i }).click()
  await expect(agenda.getByText('08:00–08:30')).toBeVisible()
  await shot(page, '05-recurring')

  // Persistence after reload (the calendar opens on this week again).
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
  await calendar.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(calendar.locator('.fc-event', { hasText: 'Deep work' }).first()).toBeVisible()

  // Delete the whole series from the agenda (month view: every occurrence is listed). The first
  // "Standup" is the separately moved occurrence; the second belongs to the series.
  await agenda.getByRole('button', { name: /^Edit Standup at/ }).nth(1).click()
  const edit = page.getByRole('dialog', { name: 'Edit event' })
  await edit.getByRole('radio', { name: 'All events in the series' }).check()
  await edit.getByRole('button', { name: /^Delete/ }).click()
  await expect(edit).toBeHidden()
  // The separately moved occurrence went with its series.
  await expect(agenda.getByRole('button', { name: /^Edit Standup at/ })).toHaveCount(0)
  await shot(page, '06-after-delete')
})
