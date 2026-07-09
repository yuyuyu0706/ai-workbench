import { expect, test } from '@playwright/test';

const globalNavigationLinks = [
  'Dashboard',
  'Prompt Library',
  'Context Library',
  'Recipe Builder',
] as const;

const nonGlobalNavigationLabels = ['Run Detail', 'Not Found', 'Root'] as const;

test.describe('AppShell navigation', () => {
  test('redirects the root URL to the Dashboard placeholder with global navigation', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('PromptTrail');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    await expect(
      page.getByText('P0-4-3で画面骨格を実装予定です。'),
    ).toBeVisible();

    const navigation = page.getByRole('navigation', {
      name: 'Global navigation',
    });
    await expect(navigation).toBeVisible();

    for (const label of globalNavigationLinks) {
      await expect(navigation.getByRole('link', { name: label })).toBeVisible();
    }

    for (const label of nonGlobalNavigationLabels) {
      await expect(navigation.getByRole('link', { name: label })).toHaveCount(
        0,
      );
    }
  });

  test('navigates between global navigation placeholders', async ({ page }) => {
    await page.goto('/dashboard');

    const navigation = page.getByRole('navigation', {
      name: 'Global navigation',
    });

    await navigation.getByRole('link', { name: 'Prompt Library' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Prompt Library' }),
    ).toBeVisible();

    await navigation.getByRole('link', { name: 'Context Library' }).click();
    await expect(page).toHaveURL(/\/contexts$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Context Library' }),
    ).toBeVisible();

    await navigation.getByRole('link', { name: 'Recipe Builder' }).click();
    await expect(page).toHaveURL(/\/recipes\/builder$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Recipe Builder' }),
    ).toBeVisible();
  });
});
