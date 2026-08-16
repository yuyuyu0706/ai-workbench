import { expect, test } from '@playwright/test';

async function openDeveloperTools(page: import('@playwright/test').Page) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Developer Tools' }).click();
  await page.locator('summary', { hasText: 'Data Scenario' }).click();
  await expect(page.getByText('Projects', { exact: true })).toBeVisible();
}

test.describe('Developer Tools data scenarios', () => {
  test('loads standard into a fresh database and rejects a second Load', async ({
    page,
  }) => {
    await openDeveloperTools(page);

    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(page.getByText(/Scenario「standard」をLoad/)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Review the implementation plan' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(
      page.getByText(/DBが空ではないためLoadしませんでした/),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Review the implementation plan' }),
    ).toBeVisible();
  });

  test('cancels and then confirms Reset without closing the panel', async ({
    page,
  }) => {
    await openDeveloperTools(page);
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Review the implementation plan' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByText(/この操作は元に戻せません/)).toBeVisible();
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(
      page.getByRole('heading', { name: 'Review the implementation plan' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: '実行する' }).click();
    await expect(page.getByText('全データをResetしました。')).toBeVisible();
    await expect(
      page.getByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeVisible();
  });

  test('replaces existing data with dense and renders its latest five runs', async ({
    page,
  }) => {
    await openDeveloperTools(page);
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Scenario' })
      .selectOption('dense');
    await page.getByRole('button', { name: 'Reset & Load' }).click();
    await expect(
      page.getByText(/Scenario「dense」へ置き換えます/),
    ).toBeVisible();
    await page.getByRole('button', { name: '実行する' }).click();

    await expect(
      page.getByText(/Scenario「dense」をReset & Load/),
    ).toBeVisible();
    const rows = page.getByRole('row').filter({
      has: page.getByRole('heading', {
        name: /A deliberately long Prompt title/,
      }),
    });
    await expect(rows).toHaveCount(5);
  });

  test('does not expose Developer Tools in a production build', async ({
    page,
  }) => {
    await page.goto('http://127.0.0.1:4174/dashboard');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Developer Tools' }),
    ).toHaveCount(0);
    await expect(page.getByRole('complementary')).toHaveCount(0);
  });
});
