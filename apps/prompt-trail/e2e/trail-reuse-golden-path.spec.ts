import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './support/layout';

const sourceTitle = 'Reusable incident review';
const sourceBody =
  'Review the incident evidence and propose follow-up actions.';
const reusedTitle = 'Reusable incident review with prevention plan';
const reusedBody = `${reusedTitle}\n\nAdd owners and due dates to every follow-up action.`;
const reusedTrailTitle = 'Prevention follow-up Trail';

test.describe('Trail reuse acceptance', () => {
  test('creates an independent Trail from the reuse-ready Prompt snapshot', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Developer Tools' }).click();
    await page.locator('summary', { hasText: 'Data Scenario' }).click();
    await page
      .getByRole('combobox', { name: 'Scenario' })
      .selectOption('reuse-ready');
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(page.getByText(/Scenario「reuse-ready」をLoad/)).toBeVisible();

    await page.goto('/prompts/reuse-ready-prompt-source/edit');
    await page.getByRole('button', { name: 'Promptを削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await expect(
      page.getByRole('table', { name: 'Prompt一覧' }).getByText(sourceTitle, {
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto('/dashboard');

    await page.getByRole('link', { name: sourceTitle, exact: true }).click();
    const sourceUrl = page.url();
    await expect(page.getByText(sourceBody, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Completed incident report' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'このPromptを再利用' }).click();

    await expect(page).toHaveURL(/\/trails\/new\?sourceRunId=/);
    await expect(page.getByLabel('Prompt本文')).toHaveValue(sourceBody);
    await expect(page.getByLabel('Trail名')).toHaveValue(sourceTitle);
    await expect(page.getByLabel('Trail種別')).toHaveValue('other');
    await expect(
      page.getByRole('link', { name: '元のTrailを確認' }),
    ).toHaveAttribute('href', new URL(sourceUrl).pathname);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Trail名').fill(reusedTrailTitle);
    await page.getByLabel('Trail種別').selectOption('incident-response');
    await page.getByLabel('Prompt本文').fill(reusedBody);
    await page.setViewportSize({ width: 320, height: 900 });
    await expectNoHorizontalOverflow(page);
    await page.getByLabel('Trail名').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Trail種別')).toBeFocused();
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page).toHaveURL(/\/trails\/(?!new)[^/?]+$/);
    await expect(page.getByText(reusedBody, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Completed incident report' }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await expect(page.getByText(reusedBody, { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();
    await expect(
      page.getByRole('heading', { name: sourceTitle, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: reusedTrailTitle }),
    ).toBeVisible();

    await page.goto('/prompts');
    await expect(
      page.getByRole('table', { name: 'Prompt一覧' }).getByText(sourceTitle, {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('table', { name: 'Prompt一覧' }).getByText(reusedTitle),
    ).toBeVisible();

    await page.goto(sourceUrl);
    await expect(page).toHaveURL(sourceUrl);
    await expect(page.getByText(sourceBody, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Completed incident report' }),
    ).toBeVisible();
  });
});
