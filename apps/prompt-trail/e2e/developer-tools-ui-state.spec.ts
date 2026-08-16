import { expect, test, type Page } from '@playwright/test';

const storageKey = 'prompt-trail:developer-tools:ui-state';

async function openDeveloperTools(page: Page) {
  if (
    !(await page
      .getByRole('complementary')
      .isVisible()
      .catch(() => false))
  ) {
    await page.getByRole('button', { name: 'Developer Tools' }).click();
  }
  await expect(page.getByText('UI State Override')).toBeVisible();
  const target = page.getByRole('combobox', { name: 'Target' });
  if (!(await target.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'UI State Override' }).click();
  }
  const scenario = page.getByRole('combobox', { name: 'Scenario' });
  if (!(await scenario.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Data Scenario' }).click();
  }
}

async function applyOverride(page: Page, target: string, state: string) {
  await openDeveloperTools(page);
  await page.getByRole('combobox', { name: 'Target' }).selectOption(target);
  await page.getByRole('combobox', { name: 'State' }).selectOption(state);
  await page.getByRole('button', { name: '適用' }).click();
}

test.describe('Developer Tools UI state overrides', () => {
  test('applies and clears a Dashboard override, restoring repository data', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(
      page.getByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeVisible();

    await applyOverride(page, 'dashboard-page', 'loading');
    await expect(
      page.getByText('Dashboardデータを読み込んでいます...'),
    ).toBeVisible();
    await page.getByRole('button', { name: '解除' }).click();
    await expect(
      page.getByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeVisible();
  });

  test('restores a New Trail override after reload', async ({ page }) => {
    await page.goto('/trails/new');
    await applyOverride(page, 'new-trail-form', 'save-failure');
    await expect(page.getByText(/保存に失敗しました/)).toBeVisible();

    await page.reload();
    await expect(
      page.getByText('UI State: New Trail Form / Save failure'),
    ).toBeVisible();
    await expect(page.getByText(/保存に失敗しました/)).toBeVisible();
  });

  test('keeps an override through Reset & Load and restores real data after clear', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await applyOverride(page, 'dashboard-page', 'loading');
    await page
      .getByRole('combobox', { name: 'Scenario' })
      .selectOption('dense');
    await page.getByRole('button', { name: 'Reset & Load' }).click();
    await page.getByRole('button', { name: '実行する' }).click();
    await expect(
      page.getByText(/Scenario「dense」をReset & Load/),
    ).toBeVisible();
    await expect(
      page.getByText('Dashboardデータを読み込んでいます...'),
    ).toBeVisible();

    await page.getByRole('button', { name: '解除' }).click();
    await expect(
      page.getByRole('heading', { name: /A deliberately long Prompt title/ }),
    ).toHaveCount(5);
  });

  test('does not expose production tools through storage, query, or route', async ({
    page,
  }) => {
    await page.goto('http://127.0.0.1:4174/dashboard');
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [
        storageKey,
        JSON.stringify({
          version: 1,
          activeOverride: { target: 'dashboard-page', state: 'loading' },
        }),
      ],
    );

    for (const path of [
      '/dashboard?developer-tools=true',
      '/developer-tools',
    ]) {
      await page.goto(`http://127.0.0.1:4174${path}`);
      await expect(
        page.getByRole('button', { name: 'Developer Tools' }),
      ).toHaveCount(0);
      await expect(page.getByText(/UI State:/)).toHaveCount(0);
    }
    await expect(
      page.getByRole('heading', { level: 1, name: 'Not Found' }),
    ).toBeVisible();
    await expect(page.getByText('未知のURLです。')).toBeVisible();
  });

  test('enables override controls in an explicit Development Preview build', async ({
    page,
  }) => {
    await page.goto('http://127.0.0.1:4175/dashboard');
    await expect(
      page.getByRole('button', { name: 'Developer Tools' }),
    ).toBeVisible();

    await applyOverride(page, 'dashboard-page', 'loading');
    await expect(page.getByText('UI State Override')).toBeVisible();
    await expect(
      page.getByText('UI State: Dashboard Page / Loading'),
    ).toBeVisible();
    await expect(
      page.getByText('Dashboardデータを読み込んでいます...'),
    ).toBeVisible();

    await page.getByRole('button', { name: '解除' }).click();
    await expect(page.getByText('UI State: なし（通常状態）')).toBeVisible();
    await expect(
      page.getByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeVisible();
  });

  test('is operable without horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/dashboard');
    await applyOverride(page, 'run-detail-link-delete', 'delete-failure');
    await expect(
      page.getByText('UI State: Run Detail Link Delete / Delete failure'),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await page.getByRole('button', { name: '解除' }).click();
  });
});
