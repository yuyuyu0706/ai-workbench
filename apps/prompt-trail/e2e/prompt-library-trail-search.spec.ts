import { expect, test } from '@playwright/test';

import { seedCanonicalSampleDataInBrowser } from './support/seed-canonical-sample-data';
import { expectNoHorizontalOverflow } from './support/layout';

const promptTitle = 'GitHub Issue作成依頼';
const trailTitle = 'GitHub Issue作成依頼';

test.describe('Prompt Library Trail search', () => {
  test('finds the linked Trail from the Prompt Library and can filter the Trail list', async ({
    page,
  }) => {
    await page.goto('/prompts');
    await seedCanonicalSampleDataInBrowser(page);
    await page.reload();

    const searchButton = page.getByRole('button', {
      name: `「${promptTitle}」から作成されたTrailを検索`,
    });
    await expect(searchButton).toBeVisible();
    await searchButton.click();

    const popover = page.getByRole('dialog', {
      name: `「${promptTitle}」から作成されたTrail`,
    });
    await expect(popover.getByRole('link', { name: trailTitle })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 900 });
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    await popover.getByRole('link', { name: 'すべて見る' }).click();

    await expect(page).toHaveURL(/\/trails\?promptId=/);
    await expect(
      page.getByText(
        `『${promptTitle}』から作成されたTrailのみ表示しています。`,
      ),
    ).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByRole('link', { name: trailTitle })).toBeVisible();

    await page.getByRole('link', { name: 'すべてのTrailを見る' }).click();
    await expect(page).toHaveURL(/\/trails$/);
  });

  test('shows an empty state when a Prompt has no linked Trail', async ({
    page,
  }) => {
    await page.goto('/prompts');
    await page.evaluate(async () => {
      const [{ createPromptTrailRuntime }, domain] = await Promise.all([
        import('/src/app/prompt-trail-runtime.ts'),
        import('/src/domain/index.ts'),
      ]);
      const runtime = createPromptTrailRuntime();
      const timestamp = '2026-08-05T00:00:00.000Z';
      try {
        await runtime.initialize();
        await runtime.repository.saveProject(
          domain.createDefaultProject(timestamp),
        );
        await runtime.repository.savePrompt({
          id: 'prompt-trail-search-empty-e2e',
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          scope: 'global',
          title: 'まだTrailがないPrompt',
          body: '本文',
          status: 'active',
          tags: [],
          variableValues: {},
        });
      } finally {
        runtime.dispose();
      }
    });
    await page.reload();

    await page
      .getByRole('button', {
        name: '「まだTrailがないPrompt」から作成されたTrailを検索',
      })
      .click();
    await expect(page.getByText('まだ紐づくTrailはありません')).toBeVisible();
  });
});
