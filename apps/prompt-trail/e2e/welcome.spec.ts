import { expect, test } from '@playwright/test';

const managementModels = [
  'Prompt',
  'Context',
  'Recipe',
  'Run',
  'Link',
] as const;

test.describe('Welcome Page', () => {
  test('shows the core PromptTrail welcome content', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('PromptTrail');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'AIへの依頼から成果までを、再利用できるTrailに。',
      }),
    ).toBeVisible();

    for (const model of managementModels) {
      await expect(
        page.getByRole('heading', { level: 3, name: model }),
      ).toBeVisible();
    }

    await expect(page.getByText('Local first', { exact: true })).toBeVisible();
    await expect(page.getByText('Phase 0', { exact: true })).toBeVisible();
  });
});
