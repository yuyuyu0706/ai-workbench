import { expect, test } from '@playwright/test';

function navigation(page: import('@playwright/test').Page) {
  return page.getByRole('navigation', { name: 'Global navigation' });
}

test.describe('Public Alpha shell', () => {
  test('shows the guide at root and opens the Dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('PromptTrail');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '次の仕事に活かせるTrailへ',
    );
    await expect(navigation(page).getByRole('link')).toHaveCount(2);
    await expect(
      navigation(page).getByRole('link', { name: 'はじめに' }),
    ).toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: 'PromptTrailを試す' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { name: 'Dashboard' }),
    ).toBeVisible();
  });

  test('keeps placeholder routes directly accessible but outside primary navigation', async ({
    page,
  }) => {
    for (const [path, heading] of [
      ['/prompts', 'Prompt Library'],
      ['/contexts', 'Context Library'],
      ['/recipes/builder', 'Recipe Builder'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(
        navigation(page).locator('a[aria-current="page"]'),
      ).toHaveCount(0);
      await expect(
        navigation(page).getByRole('link', { name: heading }),
      ).toHaveCount(0);
    }
  });

  test('shows storage and safe feedback guidance at 320px without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');
    await expect(page.getByText(/browser origin単位のIndexedDB/)).toBeVisible();
    const feedback = page
      .getByRole('main')
      .getByRole('link', { name: 'Feedbackを送る' });
    await expect(feedback).toHaveAttribute('target', '_blank');
    await expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});
