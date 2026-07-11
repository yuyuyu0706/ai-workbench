import { expect, test } from '@playwright/test';

const globalNavigationLinks = [
  'Dashboard',
  'Prompt Library',
  'Context Library',
  'Recipe Builder',
] as const;

const nonGlobalNavigationLabels = ['Run Detail', 'Not Found', 'Root'] as const;

test.describe('AppShell navigation', () => {
  test('redirects the root URL to the Dashboard skeleton with global navigation', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('PromptTrail');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    await expect(
      page.getByText('AI作業を再開するための利用開始状態です。'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '最近のRun' }),
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

  test('renders known routes from direct URLs', async ({ page }) => {
    const knownRoutes = [
      ['/dashboard', 'Dashboard', '最近のRun'],
      ['/prompts', 'Prompt Library', 'Prompt資産'],
      ['/contexts', 'Context Library', 'Context資産'],
      ['/recipes/builder', 'Recipe Builder', 'Prompt選択'],
    ] as const;

    for (const [path, heading, sectionHeading] of knownRoutes) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('navigation', { name: 'Global navigation' })
          .locator('a[aria-current="page"]'),
      ).toHaveAccessibleName(heading);

      if (sectionHeading !== undefined) {
        await expect(
          page.getByRole('heading', { level: 2, name: sectionHeading }),
        ).toBeVisible();
      }
    }
  });

  test('navigates between global navigation pages', async ({ page }) => {
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

  test('returns to Dashboard from run detail and keeps global navigation inactive', async ({
    page,
  }) => {
    await page.goto('/runs/run-123');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Run Detail' }),
    ).toBeVisible();
    await expect(
      page.getByText('Runを振り返る前の利用開始状態です。'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '成果物 / Link' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Global navigation' })
        .locator('a[aria-current="page"]'),
    ).toHaveCount(0);

    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
  });

  test('returns to Dashboard from not found and keeps global navigation inactive', async ({
    page,
  }) => {
    await page.goto('/unknown-route');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Not Found' }),
    ).toBeVisible();
    await expect(page.getByText('未知のURLです。')).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Global navigation' })
        .locator('a[aria-current="page"]'),
    ).toHaveCount(0);

    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
  });
});
