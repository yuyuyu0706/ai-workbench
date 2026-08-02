import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './support/layout';

const runPath = '/runs/reuse-ready-run-completed-source';

async function loadReuseReady(page: import('@playwright/test').Page) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Developer Tools' }).click();
  await page
    .getByRole('combobox', { name: 'Scenario' })
    .selectOption('reuse-ready');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.getByText(/Scenario「reuse-ready」をLoad/)).toBeVisible();
  await page.goto(runPath);
}

test.describe('Run Detail Trail metadata', () => {
  test('edits, reloads, opens directly, and reuses the latest metadata responsively', async ({
    page,
  }) => {
    await loadReuseReady(page);
    await page.getByRole('button', { name: 'Trail情報を編集' }).click();
    await expect(page.getByLabel('Trail名')).toBeFocused();
    await page.getByLabel('Trail名').fill('Updated incident Trail');
    await page.getByLabel('Trail種別').selectOption('incident-response');
    await page.setViewportSize({ width: 320, height: 900 });
    await expectNoHorizontalOverflow(page);
    await page.getByLabel('Trail名').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Trail種別')).toBeFocused();
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(page.getByText('Trail情報を保存しました。')).toBeVisible();

    await page.reload();
    await expect(
      page.getByText('Updated incident Trail', { exact: true }),
    ).toBeVisible();
    await page.goto(runPath);
    await expect(page.getByText('障害対応')).toBeVisible();
    await page.getByRole('link', { name: 'このPromptを再利用' }).click();
    await expect(page.getByLabel('Trail名')).toHaveValue(
      'Updated incident Trail',
    );
    await expect(page.getByLabel('Trail種別')).toHaveValue('incident-response');
    await expectNoHorizontalOverflow(page);
  });

  test('rejects a stale update across two pages in one browser context', async ({
    page,
    context,
  }) => {
    await loadReuseReady(page);
    const second = await context.newPage();
    await second.goto(runPath);
    await second.getByRole('button', { name: 'Trail情報を編集' }).click();
    await second.getByLabel('Trail名').fill('Second page draft');

    await page.getByRole('button', { name: 'Trail情報を編集' }).click();
    await page.getByLabel('Trail名').fill('First page saved');
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(page.getByText('Trail情報を保存しました。')).toBeVisible();

    await second.getByRole('button', { name: '変更を保存' }).click();
    await expect(second.getByRole('alert')).toContainText(
      '別の画面でTrail情報が更新されました',
    );
    await expect(second.getByLabel('Trail名')).toHaveValue('Second page draft');
    await expect(second.getByLabel('Trail名')).toBeDisabled();
    await second.getByRole('button', { name: '最新内容を読み込む' }).click();
    await expect(
      second.getByText('First page saved', { exact: true }),
    ).toBeVisible();
  });
});
