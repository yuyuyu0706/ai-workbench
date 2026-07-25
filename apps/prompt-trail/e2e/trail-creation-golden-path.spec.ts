import { expect, type Locator, type Page, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './support/layout';

const promptTitle = 'Issue 161 Golden Path';
const promptBody = `\n${promptTitle}\n\n作成したTrailの永続性を確認する。`;
const linkUrl = 'https://example.com/prompt-trail/issue-161';

function getPromptSnapshot(page: Page): Locator {
  return page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: 'Prompt Snapshot' }),
  });
}

function getLinkSection(page: Page): Locator {
  return page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: '成果物 / Link' }),
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
  await expect(savedLink).toContainText('document / reference');
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

    await expect(page).toHaveURL(/\/runs\/[^/]+$/);
    const runDetailUrl = page.url();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Run Detail' }),
    ).toBeVisible();
    const snapshot = getPromptSnapshot(page);
    await expect(snapshot.getByRole('heading', { level: 3 })).toHaveText(
      promptTitle,
    );
    await expect(snapshot.locator('pre')).toHaveText(promptBody);

    await page.getByLabel('URL').fill(linkUrl);
    await page.getByLabel('Link種別').selectOption('document');
    await page.getByLabel('Link役割').selectOption('reference');
    await page.getByRole('button', { name: 'Linkを登録' }).click();
    await expectCreatedTrail(page);
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await expect(page).toHaveURL(runDetailUrl);
    await expectCreatedTrail(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();
    const recentRun = page.locator('article').filter({
      has: page.getByRole('heading', { level: 3, name: promptTitle }),
    });
    await expect(recentRun).toContainText('1件');
    await expectNoHorizontalOverflow(page);

    await recentRun.getByRole('link', { name: 'Run Detailへ移動' }).click();
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
    await urlInput.fill('ftp://example.com/result');
    await page.getByRole('button', { name: 'Linkを登録' }).click();
    await expect(page.getByText(/Linkを保存できませんでした。/)).toBeVisible();
    await expect(urlInput).toHaveValue('ftp://example.com/result');

    await urlInput.fill(linkUrl);
    await page.getByRole('button', { name: 'Linkを登録' }).click();
    await expect(page.getByRole('link', { name: linkUrl })).toHaveAttribute(
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
