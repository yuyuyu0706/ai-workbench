import { expect, type Locator, type Page, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './support/layout';

const promptTitle = 'Issue 161 Golden Path';
const promptBody = `\n${promptTitle}\n\n作成したTrailの永続性を確認する。`;
const linkUrl = 'https://example.com/prompt-trail/issue-161';
const linkTitle = 'Golden Path document';

function getPromptSnapshot(page: Page): Locator {
  return page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: 'Prompt' }),
  });
}

function getLinkSection(page: Page): Locator {
  return page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: '関連リンク' }),
  });
}

async function expectCreatedTrail(page: Page) {
  const snapshot = getPromptSnapshot(page);
  await expect(snapshot.getByRole('heading', { level: 3 })).toHaveText(
    promptTitle,
  );
  await expect(snapshot.locator('pre')).toHaveText(promptBody);

  const savedLink = getLinkSection(page).getByRole('listitem');
  await expect(savedLink.getByRole('link')).toHaveAttribute('href', linkUrl);
  await expect(savedLink.getByRole('link', { name: linkTitle })).toBeVisible();
  await expect(savedLink).toContainText(linkUrl);
  await expect(savedLink).toContainText('Document');
}

test.describe('first Trail creation acceptance', () => {
  test('creates and persists a direct Trail from the Dashboard', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: '新しいTrailを始める' }).click();
    await expect(page).toHaveURL(/\/runs\/new$/);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Prompt本文').fill(promptBody);
    await page.getByRole('button', { name: 'Trailを作成' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Run Detail' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/runs\/(?!new$)[^/]+$/);
    await expect(
      page.getByRole('status').filter({ hasText: 'Trailを作成しました。' }),
    ).toBeVisible();
    const runDetailUrl = page.url();
    const snapshot = getPromptSnapshot(page);
    await expect(snapshot.getByRole('heading', { level: 3 })).toHaveText(
      promptTitle,
    );
    await expect(snapshot.locator('pre')).toHaveText(promptBody);

    await page.getByLabel('Link名称').fill(linkTitle);
    await page.getByLabel('URL').fill(linkUrl);
    await page.getByLabel('Link種別').selectOption('document');
    await page.getByRole('button', { name: '関連リンクを登録' }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: '関連リンクを登録しました。' }),
    ).toBeVisible();
    await expectCreatedTrail(page);
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await expect(page).toHaveURL(runDetailUrl);
    await expect(page.getByText('Trailを作成しました。')).toHaveCount(0);
    await expect(page.getByText('関連リンクを登録しました。')).toHaveCount(0);
    await expectCreatedTrail(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();
    const recentRun = page.getByRole('row').filter({
      has: page.getByRole('heading', { level: 3, name: promptTitle }),
    });
    await expect(recentRun).toContainText('1件');
    await expectNoHorizontalOverflow(page);

    await recentRun.getByRole('link', { name: 'Trailを確認' }).click();
    await expect(page).toHaveURL(runDetailUrl);
    await expectCreatedTrail(page);
  });

  test('recovers from representative validation and not-found states', async ({
    page,
  }) => {
    await page.goto('/runs/new');

    const promptInput = page.getByLabel('Prompt本文');
    await promptInput.fill('   ');
    await expect(
      page.getByText('Prompt本文を入力してください。'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Trailを作成' }),
    ).toBeDisabled();
    await expect(promptInput).toHaveValue('   ');

    await promptInput.fill(promptBody);
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page).toHaveURL(/\/runs\/[^/]+$/);

    const urlInput = page.getByLabel('URL');
    await page.getByLabel('Link名称').fill(linkTitle);
    await page.getByLabel('Link種別').selectOption('document');
    await urlInput.fill('ftp://example.com/result');
    await page.getByRole('button', { name: '関連リンクを登録' }).click();
    await expect(page.getByText(/http または https/)).toBeVisible();
    await expect(urlInput).toHaveValue('ftp://example.com/result');

    await urlInput.fill(linkUrl);
    await page.getByRole('button', { name: '関連リンクを登録' }).click();
    await expect(page.getByRole('link', { name: linkTitle })).toHaveAttribute(
      'href',
      linkUrl,
    );

    await page.goto('/runs/missing-issue-161-run');
    await expect(
      page.getByText('指定されたRunが見つかりません。'),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
  });
});
