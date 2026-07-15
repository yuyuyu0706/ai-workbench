import { expect, type Locator, type Page, test } from '@playwright/test';

const globalNavigationLinks = [
  'Dashboard',
  'Prompt Library',
  'Context Library',
  'Recipe Builder',
] as const;

const nonGlobalNavigationLabels = ['Run Detail', 'Not Found', 'Root'] as const;

const primaryRoutes = [
  {
    path: '/dashboard',
    heading: 'Dashboard',
    currentNavigationLabel: 'Dashboard',
    startState: 'Repositoryに表示できるRunがまだありません。',
  },
  {
    path: '/prompts',
    heading: 'Prompt Library',
    currentNavigationLabel: 'Prompt Library',
    startState: 'Prompt資産を登録する前の利用開始状態です。',
  },
  {
    path: '/contexts',
    heading: 'Context Library',
    currentNavigationLabel: 'Context Library',
    startState: 'Context資産を登録する前の利用開始状態です。',
  },
  {
    path: '/recipes/builder',
    heading: 'Recipe Builder',
    currentNavigationLabel: 'Recipe Builder',
    startState: 'Recipeを組み立てる前の利用開始状態です。',
  },
] as const;

function getGlobalNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Global navigation' });
}

async function expectHeading(page: Page, name: string) {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function expectCurrentNavigation(navigation: Locator, name: string) {
  await expect(
    navigation.locator('a[aria-current="page"]'),
  ).toHaveAccessibleName(name);
}

async function expectNoCurrentNavigation(navigation: Locator) {
  await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(0);
}

test.describe('AppShell navigation', () => {
  test('redirects the root URL to the Dashboard skeleton with global navigation', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('PromptTrail');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectHeading(page, 'Dashboard');
    await expect(
      page.getByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeVisible();
    const navigation = getGlobalNavigation(page);
    await expect(navigation).toBeVisible();
    await expectCurrentNavigation(navigation, 'Dashboard');

    for (const label of globalNavigationLinks) {
      await expect(navigation.getByRole('link', { name: label })).toBeVisible();
    }

    for (const label of nonGlobalNavigationLabels) {
      await expect(navigation.getByRole('link', { name: label })).toHaveCount(
        0,
      );
    }
  });

  test('navigates between global navigation pages', async ({ page }) => {
    await page.goto('/dashboard');

    const navigation = getGlobalNavigation(page);

    for (const { path, heading, currentNavigationLabel } of primaryRoutes) {
      await navigation
        .getByRole('link', { name: currentNavigationLabel })
        .click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expectHeading(page, heading);
      await expectCurrentNavigation(navigation, currentNavigationLabel);
    }
  });

  test('renders primary pages from direct URLs', async ({ page }) => {
    for (const {
      path,
      heading,
      currentNavigationLabel,
      startState,
    } of primaryRoutes) {
      await page.goto(path);

      const navigation = getGlobalNavigation(page);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expectHeading(page, heading);
      await expect(page.getByText(startState)).toBeVisible();
      await expectCurrentNavigation(navigation, currentNavigationLabel);
    }
  });

  test('renders run detail from a direct URL without active global navigation', async ({
    page,
  }) => {
    await page.goto('/runs/test-run');

    await expect(page).toHaveURL(/\/runs\/test-run$/);
    await expectHeading(page, 'Run Detail');
    await expect(
      page.getByText('Runを振り返る前の利用開始状態です。'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '成果物 / Link' }),
    ).toBeVisible();
    await expectNoCurrentNavigation(getGlobalNavigation(page));
  });

  test('returns to Dashboard from run detail and keeps global navigation inactive', async ({
    page,
  }) => {
    await page.goto('/runs/test-run');

    await expectHeading(page, 'Run Detail');
    await expect(
      page.getByText('Runを振り返る前の利用開始状態です。'),
    ).toBeVisible();
    await expectNoCurrentNavigation(getGlobalNavigation(page));

    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expectHeading(page, 'Dashboard');
    await expectCurrentNavigation(getGlobalNavigation(page), 'Dashboard');
  });

  test('returns to Dashboard from not found and keeps global navigation inactive', async ({
    page,
  }) => {
    await page.goto('/unknown-route');

    await expectHeading(page, 'Not Found');
    await expect(page.getByText('未知のURLです。')).toBeVisible();
    await expectNoCurrentNavigation(getGlobalNavigation(page));

    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expectHeading(page, 'Dashboard');
    await expectCurrentNavigation(getGlobalNavigation(page), 'Dashboard');
  });
});
