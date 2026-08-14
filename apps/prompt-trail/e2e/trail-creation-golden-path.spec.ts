import { expect, type Locator, type Page, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './support/layout';

const promptTitle = 'Issue 161 Golden Path';
const trailTitle = 'Issue 213 custom Trail';
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
    await expect(page).toHaveURL(/\/trails\/new$/);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Trail名').fill(trailTitle);
    await page.getByLabel('Trail種別').selectOption('development');
    await page.getByLabel('Prompt本文').fill(promptBody);
    await page.getByRole('button', { name: 'Trailを作成' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Run Detail' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/trails\/(?!new$)[^/]+$/);
    await expect(
      page.getByRole('status').filter({ hasText: 'Trailを作成しました。' }),
    ).toBeVisible();
    const runSummary = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: '実行サマリ' }),
    });
    await expect(runSummary.locator('time')).toHaveCount(2);
    await expect(runSummary.locator('time').first()).toHaveText(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
    const linkInformationButton = page.getByRole('button', {
      name: '関連リンクについて',
    });
    await linkInformationButton.click();
    await expect(
      page.getByText('この作業で参照したChat・Issue・PR', { exact: false }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(linkInformationButton).toBeFocused();
    await expect(linkInformationButton).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    const originalViewport = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 900 });
    await linkInformationButton.click();
    const desktopPopover = page.getByText('この作業で参照したChat・Issue・PR', {
      exact: false,
    });
    const desktopButtonBounds = await linkInformationButton.boundingBox();
    const desktopPopoverBounds = await desktopPopover.boundingBox();
    expect(desktopButtonBounds).not.toBeNull();
    expect(desktopPopoverBounds).not.toBeNull();
    expect(desktopPopoverBounds!.x).toBeGreaterThan(
      desktopButtonBounds!.x + desktopButtonBounds!.width,
    );
    expect(
      Math.abs(
        desktopPopoverBounds!.y +
          desktopPopoverBounds!.height -
          (desktopButtonBounds!.y + desktopButtonBounds!.height / 2),
      ),
    ).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    for (const width of [320, 375, 430, 520]) {
      await page.setViewportSize({
        width,
        height: originalViewport?.height ?? 900,
      });
      await linkInformationButton.click();
      await expectNoHorizontalOverflow(page);
      const popover = page.getByText('この作業で参照したChat・Issue・PR', {
        exact: false,
      });
      const bounds = await popover.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');
    }
    if (originalViewport !== null) {
      await page.setViewportSize(originalViewport);
    }
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

    await page.getByRole('link', { name: 'このPromptを再利用' }).click();
    await expect(page.getByLabel('Trail名')).toHaveValue(trailTitle);
    await expect(page.getByLabel('Trail種別')).toHaveValue('development');
    await expect(page.getByLabel('Prompt本文')).toHaveValue(promptBody.trim());
    await page.goto(runDetailUrl);

    const deleteButton = page.getByRole('button', {
      name: `${linkTitle}を削除`,
    });
    const viewportBeforeDelete = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 900 });
    await deleteButton.click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'キャンセル' }).click();
    if (viewportBeforeDelete !== null) {
      await page.setViewportSize(viewportBeforeDelete);
    }
    await expectCreatedTrail(page);
    await deleteButton.click();
    await page.getByRole('button', { name: '削除する' }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: '関連リンクを削除しました。' }),
    ).toBeVisible();
    await expect(getLinkSection(page).getByRole('listitem')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await expect(getLinkSection(page).getByRole('listitem')).toHaveCount(0);

    await page.getByRole('link', { name: 'Dashboardへ戻る' }).click();
    const recentRun = page.getByRole('row').filter({
      has: page.getByRole('heading', { level: 3, name: trailTitle }),
    });
    await expect(recentRun).toContainText('0件');
    await expectNoHorizontalOverflow(page);

    await recentRun.getByRole('link', { name: trailTitle }).click();
    await expect(page).toHaveURL(runDetailUrl);
    await expect(getLinkSection(page).getByRole('listitem')).toHaveCount(0);
  });

  test('recovers from representative validation and not-found states', async ({
    page,
  }) => {
    await page.goto('/trails/new');

    const promptInput = page.getByLabel('Prompt本文');
    await promptInput.fill('   ');
    await expect(
      page.getByText('Prompt本文を入力してください。'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page.getByLabel('Trail名')).toBeFocused();
    await expect(promptInput).toHaveValue('   ');

    await promptInput.fill(promptBody);
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page).toHaveURL(/\/trails\/[^/]+$/);

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

    await page.goto('/trails/missing-issue-161-trail');
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
