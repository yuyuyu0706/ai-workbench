import { expect, type Locator, type Page, test } from '@playwright/test';

const viewports = [
  { name: 'desktop', size: { width: 1280, height: 720 } },
  { name: 'small', size: { width: 390, height: 844 } },
] as const;

const globalNavigationLinks = [
  'Dashboard',
  'Prompt Library',
  'Context Library',
  'Recipe Builder',
] as const;

const primaryPages = [
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
    sectionHeading: 'Prompt資産',
    startState: 'Prompt資産を登録する前の利用開始状態です。',
  },
  {
    path: '/contexts',
    heading: 'Context Library',
    currentNavigationLabel: 'Context Library',
    sectionHeading: 'Context資産',
    startState: 'Context資産を登録する前の利用開始状態です。',
  },
  {
    path: '/recipes/builder',
    heading: 'Recipe Builder',
    currentNavigationLabel: 'Recipe Builder',
    sectionHeading: 'Prompt選択',
    startState: 'Recipeを組み立てる前の利用開始状態です。',
  },
] as const;

const secondaryPages = [
  {
    path: '/runs/test-run',
    heading: 'Run Detail',
    sectionHeading: '成果物 / Link',
    startState: 'Runを振り返る前の利用開始状態です。',
  },
  {
    path: '/unknown-route',
    heading: 'Not Found',
    startState: '未知のURLです。',
  },
] as const;

function getGlobalNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Global navigation' });
}

function getMain(page: Page) {
  return page.getByRole('main');
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectCurrentNavigation(navigation: Locator, name: string) {
  await expect(
    navigation.locator('a[aria-current="page"]'),
  ).toHaveAccessibleName(name);
}

async function expectNoCurrentNavigation(navigation: Locator) {
  await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(0);
}

async function expectReadableBaseline(
  page: Page,
  pageInfo: {
    heading: string;
    sectionHeading?: string;
    startState: string;
  },
) {
  await expect(getMain(page)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: pageInfo.heading }),
  ).toBeVisible();
  if (pageInfo.sectionHeading !== undefined) {
    await expect(
      page.getByRole('heading', { level: 2, name: pageInfo.sectionHeading }),
    ).toBeVisible();
  }
  await expect(page.getByText(pageInfo.startState)).toBeVisible();
}

test.describe('responsive and accessibility quality baseline', () => {
  for (const { name, size } of viewports) {
    test(`renders the Dashboard AppShell baseline at ${name} viewport`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto('/dashboard');

      const navigation = getGlobalNavigation(page);

      await expect(navigation).toBeVisible();
      await expectReadableBaseline(page, primaryPages[0]);
      await expectCurrentNavigation(navigation, 'Dashboard');
      await expectNoHorizontalOverflow(page);
    });
  }

  test('keeps small viewport global navigation visible, operable, and within the page width', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    const navigation = getGlobalNavigation(page);
    await expect(navigation).toBeVisible();

    for (const label of globalNavigationLinks) {
      const link = navigation.getByRole('link', { name: label });
      await expect(link).toBeVisible();
      await expect(link).toBeInViewport();
    }

    await navigation.getByRole('link', { name: 'Recipe Builder' }).click();

    await expect(page).toHaveURL(/\/recipes\/builder$/);
    await expectReadableBaseline(page, primaryPages[3]);
    await expectCurrentNavigation(navigation, 'Recipe Builder');
    await expectNoHorizontalOverflow(page);
  });

  test('keeps primary pages within the small viewport with semantic headings and current navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const pageInfo of primaryPages) {
      await page.goto(pageInfo.path);

      const navigation = getGlobalNavigation(page);
      await expect(navigation).toBeVisible();
      await expectReadableBaseline(page, pageInfo);
      await expectCurrentNavigation(
        navigation,
        pageInfo.currentNavigationLabel,
      );
      await expectNoHorizontalOverflow(page);
    }
  });

  test('keeps secondary pages accessible without global navigation current state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const pageInfo of secondaryPages) {
      await page.goto(pageInfo.path);

      await expectReadableBaseline(page, pageInfo);
      await expectNoCurrentNavigation(getGlobalNavigation(page));
      await expect(
        page.getByRole('link', { name: 'Dashboardへ戻る' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
