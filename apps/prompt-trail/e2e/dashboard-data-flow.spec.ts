import { expect, type Locator, type Page, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './support/layout';
import { seedCanonicalSampleDataInBrowser } from './support/seed-canonical-sample-data';

function getGlobalNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Global navigation' });
}

function getCanonicalRecentRunCard(page: Page): Locator {
  return page.locator('article').filter({
    has: page.getByRole('heading', { name: 'GitHub Issue作成依頼' }),
  });
}

async function expectCanonicalSeededDashboard(
  page: Page,
  seedResult: { readonly sampleRunUpdatedAt: string },
) {
  await expect(
    page.getByRole('heading', { level: 2, name: '最近のRun' }),
  ).toBeVisible();

  const recentRunCard = getCanonicalRecentRunCard(page);
  await expect(recentRunCard).toHaveCount(1);
  await expect(recentRunCard).toBeVisible();
  await expect(
    recentRunCard.getByText('PromptTrail Development'),
  ).toBeVisible();
  await expect(recentRunCard.getByText('done')).toBeVisible();
  await expect(recentRunCard.getByText('good')).toBeVisible();
  await expect(recentRunCard.getByText('3件')).toBeVisible();

  const updatedAt = recentRunCard.locator('time');
  await expect(updatedAt).toHaveAttribute(
    'dateTime',
    seedResult.sampleRunUpdatedAt,
  );
  await expect(updatedAt).toHaveText(seedResult.sampleRunUpdatedAt);

  const relatedLinks = recentRunCard.getByRole('listitem');
  await expect(relatedLinks).toHaveCount(3);
  await expect(recentRunCard.getByText('Roadmap再同期 Chat')).toBeVisible();
  await expect(
    recentRunCard.getByText('Roadmap再同期 Issue #100'),
  ).toBeVisible();
  await expect(recentRunCard.getByText('Roadmap再同期 PR #101')).toBeVisible();

  return recentRunCard;
}

test.describe('Dashboard data flow', () => {
  test('connects a fresh Dashboard, browser safe seed, Related Links, and Run Detail', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    await expect(
      page.getByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeVisible();

    const seedResult = await seedCanonicalSampleDataInBrowser(page);
    expect(seedResult.status).toBe('seeded');

    const navigation = getGlobalNavigation(page);
    await navigation.getByRole('link', { name: 'Prompt Library' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Prompt Library' }),
    ).toBeVisible();

    await navigation.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { level: 2, name: '最近のRun' }),
    ).toBeVisible();

    const recentRunCard = await expectCanonicalSeededDashboard(
      page,
      seedResult,
    );

    await recentRunCard.getByRole('link', { name: 'Run Detailへ移動' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/runs/${seedResult.sampleRunId}$`),
    );
    await expect(
      page.getByRole('heading', { level: 1, name: 'Run Detail' }),
    ).toBeVisible();
  });

  test('keeps canonical Dashboard data after reload without reseeding', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const seedResult = await seedCanonicalSampleDataInBrowser(page);
    expect(seedResult.status).toBe('seeded');

    await page.reload();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    await expectCanonicalSeededDashboard(page, seedResult);
  });

  test('keeps browser safe seed idempotent without duplicate Dashboard data', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const firstSeedResult = await seedCanonicalSampleDataInBrowser(page);
    expect(firstSeedResult.status).toBe('seeded');

    const secondSeedResult = await seedCanonicalSampleDataInBrowser(page);
    expect(secondSeedResult.status).toBe('already-present');

    await page.reload();

    await expectCanonicalSeededDashboard(page, firstSeedResult);
  });

  test('keeps the seeded Dashboard within the viewport width', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const seedResult = await seedCanonicalSampleDataInBrowser(page);
    expect(seedResult.status).toBe('seeded');

    await page.reload();

    await expectCanonicalSeededDashboard(page, seedResult);
    await expectNoHorizontalOverflow(page);
  });
});
