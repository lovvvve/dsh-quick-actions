import { expect, test } from '@playwright/test'
import { actionFaces, layoutCell, openResidentComposer } from './support.js'

/**
 * DSH 0.1.7's one-shot legacy import landing in this plugin (spec 22.7, ticket 34): a
 * `<DSH_HOME>/settings.yaml` section written by the 0.1.5-line plugin becomes this entry's
 * Config on the first boot of the new line, and the Client shows it.
 *
 * Driven by `tests/gui/import-round.sh`, which boots a throwaway DSH_HOME — a real home can
 * import only once, and the user's has already done so — seeded with a `bar` layout and one
 * Custom Quick Action under the label below.
 */
const seeded = process.env.DSH_QA_IMPORT === '1'
const IMPORTED_LABEL = '导入验证'

test.describe('a section imported from the legacy settings.yaml', () => {
  test.skip(!seeded, 'run through tests/gui/import-round.sh')

  test('comes back as the layout and the actions it stored', async ({ page }) => {
    // A fresh home greets its first page load with DSH's own first-run modals — the testing
    // notice, then the API key prompt — whose masks swallow the sidebar click. The user's
    // home dealt with both long ago; nothing here needs a model, so the key is deferred.
    await page.addLocatorHandler(page.getByRole('dialog', { name: /Internal Testing Notice/ }), async (dialog) => {
      await dialog.getByRole('button', { name: 'Continue' }).click()
    })
    await page.addLocatorHandler(page.getByRole('dialog', { name: /Add an API key/ }), async (dialog) => {
      await dialog.getByRole('button', { name: 'Configure later' }).click()
    })
    await openResidentComposer(page)

    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar')
    await expect(actionFaces(page).filter({ hasText: IMPORTED_LABEL })).toHaveCount(1)
  })
})
