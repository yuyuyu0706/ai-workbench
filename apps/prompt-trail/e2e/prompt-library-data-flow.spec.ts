import { expect, type Page, test } from '@playwright/test';

import type { PromptId, UtcDateTimeString } from '../src/domain';

import { expectNoHorizontalOverflow } from './support/layout';
const GLOBAL_PROMPT_BODY = [
  'Global Promptの本文',
  ...Array.from({ length: 55 }, (_, index) => `長文行 ${index + 1}`),
  '長い英数字ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  'PROMPT_BODY_END_MARKER',
].join('\n');
async function seedPromptLibraryInBrowser(page: Page) {
  await page.evaluate(async () => {
    const [{ createPromptTrailRuntime }, domain] = await Promise.all([
      import('/src/app/prompt-trail-runtime.ts'),
      import('/src/domain/index.ts'),
    ]);
    const runtime = createPromptTrailRuntime();
    const timestamp = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;

    try {
      await runtime.initialize();
      await runtime.repository.saveProject(
        domain.createDefaultProject(timestamp),
      );
      await runtime.repository.savePrompt({
        id: 'prompt-library-e2e' as PromptId,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        scope: 'project',
        projectId: domain.DEFAULT_PROJECT_ID,
        title: 'Codex開発依頼',
        body: '変更内容を確認して実装してください。',
        kind: 'codex-request',
        status: 'active',
        tags: [],
      });
    } finally {
      runtime.dispose();
    }
  });
}

async function seedGlobalPromptInBrowser(page: Page) {
  await page.evaluate(async (body) => {
    const { createPromptTrailRuntime } =
      await import('/src/app/prompt-trail-runtime.ts');
    const runtime = createPromptTrailRuntime();
    try {
      await runtime.initialize();
      await runtime.repository.savePrompt({
        id: 'prompt-library-global-e2e' as PromptId,
        createdAt: '2026-08-01T01:00:00.000Z' as UtcDateTimeString,
        updatedAt: '2026-08-01T01:00:00.000Z' as UtcDateTimeString,
        deletedAt: null,
        scope: 'global',
        title: 'Global障害分析',
        body,
        kind: 'incident-analysis',
        status: 'active',
        tags: [],
      });
    } finally {
      runtime.dispose();
    }
  }, GLOBAL_PROMPT_BODY);
}

test.describe('Prompt Library data flow', () => {
  test('supports direct access, repository data, search, and reload', async ({
    context,
    page,
  }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    if (testInfo.project.name === 'chromium-desktop')
      await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/prompts');
    await expect(
      page
        .getByRole('navigation', { name: 'Global navigation' })
        .getByRole('link', { name: 'Prompt Library' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByText('Repositoryに表示できるPromptがまだありません。'),
    ).toBeVisible();

    await seedPromptLibraryInBrowser(page);
    await seedGlobalPromptInBrowser(page);
    await page.reload();

    await expect(
      page.getByRole('heading', { level: 2, name: 'Prompt一覧' }),
    ).toBeVisible();
    const promptTable = page.getByRole('table', { name: 'Prompt一覧' });
    await expect(promptTable.getByRole('columnheader')).toHaveCount(6);
    await expect(
      promptTable.getByRole('columnheader', { name: 'Prompt名' }),
    ).toBeVisible();
    await expect(
      promptTable.getByRole('columnheader', { name: 'タイトル' }),
    ).toHaveCount(0);
    await expect(
      page.getByPlaceholder('Prompt名または本文を検索'),
    ).toBeVisible();
    await expect(promptTable.getByRole('row')).toHaveCount(3);
    await expect(promptTable.getByText('Codex開発依頼')).toBeVisible();
    await expect(promptTable.getByText('Global障害分析')).toBeVisible();
    await expect(promptTable).toHaveClass(/pt-prompt-table--compact/);
    const shortRow = promptTable.locator('tbody tr', {
      hasText: 'Codex開発依頼',
    });
    await expect(shortRow.locator('td').first()).toHaveCSS(
      'padding-top',
      '8px',
    );
    if (testInfo.project.name === 'chromium-desktop') {
      const shortRowBox = await shortRow.boundingBox();
      expect(shortRowBox).not.toBeNull();
      expect(shortRowBox!.height).toBeLessThan(64);
    }
    const newPromptLink = page.getByRole('link', { name: 'Promptを新規登録' });
    const createTrailLink = page.getByRole('link', {
      name: '「Codex開発依頼」からTrailを作成',
    });
    await expect(newPromptLink).toHaveCSS('text-decoration-line', 'none');
    await expect(createTrailLink).toHaveCSS('text-decoration-line', 'none');
    const titleLink = page.getByRole('link', {
      name: '「Codex開発依頼」を編集',
    });
    expect(
      await titleLink.evaluate(
        (element) => getComputedStyle(element).fontWeight,
      ),
    ).toBe('400');
    await expect(titleLink).toHaveClass(/pt-prompt-table__title-link/);
    await titleLink.click();
    await expect(page).toHaveURL(/\/prompts\/prompt-library-e2e\/edit$/);
    await page.goBack();
    await expect(promptTable).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Promptを検索' });
    const projectFilter = page.getByRole('combobox', { name: 'プロジェクト' });
    await expect(page.getByText('全2件を表示')).toBeVisible();
    await projectFilter.selectOption('project');
    await expect(page.getByText('全2件中 1件を表示')).toBeVisible();
    await expect(promptTable.getByText('Global障害分析')).toHaveCount(0);
    await search.fill('  codex  ');
    await expect(promptTable.getByRole('row')).toHaveCount(2);

    await search.fill('一致しない検索条件');
    await expect(page.getByText('全2件中 0件を表示')).toBeVisible();
    await expect(
      page.getByText('条件に一致するPromptがありません。'),
    ).toBeVisible();

    await page.getByRole('button', { name: '条件をクリア' }).click();
    await expect(projectFilter).toHaveValue('all');
    await expect(promptTable.getByRole('row')).toHaveCount(3);

    const projectTrigger = page.getByRole('button', {
      name: '「Codex開発依頼」のPrompt本文を表示',
    });
    const globalTrigger = page.getByRole('button', {
      name: '「Global障害分析」のPrompt本文を表示',
    });
    await projectTrigger.hover();
    const tooltipId = await projectTrigger.getAttribute('aria-describedby');
    expect(tooltipId).not.toBeNull();
    await expect(page.locator(`#${tooltipId}`)).toHaveCSS('opacity', '1');
    await expect(page.getByRole('dialog', { name: 'Prompt本文' })).toHaveCount(
      0,
    );
    await projectTrigger.click();
    const popover = page.getByRole('dialog', { name: 'Prompt本文' });
    await expect(popover).toContainText('変更内容を確認して実装してください。');
    if (testInfo.project.name === 'chromium-desktop') {
      await expect(popover).toHaveAttribute('data-placement', 'right-start');
      const triggerRect = await projectTrigger.boundingBox();
      const popoverRect = await popover.boundingBox();
      expect(triggerRect).not.toBeNull();
      expect(popoverRect).not.toBeNull();
      expect(popoverRect!.x).toBeGreaterThanOrEqual(
        triggerRect!.x + triggerRect!.width,
      );
    }
    await globalTrigger.click();
    await expect(popover).toContainText('Global Promptの本文');
    const popoverContent = popover.locator('.pt-prompt-body-popover__content');
    expect(
      await popoverContent.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await popoverContent.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const scrollTopBeforeCopy = await popoverContent.evaluate(
      (element) => element.scrollTop,
    );
    await popover
      .getByRole('button', { name: '「Global障害分析」のPrompt本文をコピー' })
      .click();
    await expect(popover.getByText('コピーしました')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      GLOBAL_PROMPT_BODY,
    );
    expect(await popoverContent.evaluate((element) => element.scrollTop)).toBe(
      scrollTopBeforeCopy,
    );
    await expect(popover).toBeVisible();
    await expect(popover.getByText('PROMPT_BODY_END_MARKER')).toBeInViewport();
    await popoverContent.click();
    await expect(popover).toBeVisible();
    await popoverContent.dispatchEvent('wheel');
    await expect(popover).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Prompt本文' })).toHaveCount(
      0,
    );
    const globalTooltipId =
      await globalTrigger.getAttribute('aria-describedby');
    expect(globalTooltipId).not.toBeNull();
    if (testInfo.project.name === 'chromium-desktop') {
      await expect(page.locator(`#${globalTooltipId}`)).toHaveCSS(
        'opacity',
        '0',
      );
      await globalTrigger.hover();
      await expect(page.locator(`#${globalTooltipId}`)).toHaveCSS(
        'opacity',
        '1',
      );
    }
    await page
      .getByRole('heading', { level: 1, name: 'Prompt Library' })
      .hover();
    await globalTrigger.click();
    await page
      .getByRole('heading', { level: 1, name: 'Prompt Library' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Prompt本文' })).toHaveCount(
      0,
    );
    if (testInfo.project.name === 'chromium-desktop')
      await expect(page.locator(`#${globalTooltipId}`)).toHaveCSS(
        'opacity',
        '0',
      );
    await globalTrigger.click();
    await page.getByRole('button', { name: 'Prompt本文を閉じる' }).click();
    await expect(globalTrigger).toBeFocused();
    if (testInfo.project.name === 'chromium-desktop')
      await expect(page.locator(`#${globalTooltipId}`)).toHaveCSS(
        'opacity',
        '0',
      );
    await page.reload();
    await expect(promptTable.getByText('Codex開発依頼')).toBeVisible();
  });

  test('keeps search and prompt data within a 320px viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/prompts');
    await seedPromptLibraryInBrowser(page);
    await page.reload();

    await expect(
      page.getByRole('searchbox', { name: 'Promptを検索' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const tableRegion = page.getByRole('region', {
      name: 'Prompt一覧テーブル',
    });
    expect(
      await tableRegion.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    const promptTrigger = page.getByRole('button', {
      name: '「Codex開発依頼」のPrompt本文を表示',
    });
    await page.getByRole('combobox', { name: 'プロジェクト' }).focus();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('searchbox', { name: 'Promptを検索' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tableRegion).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: '「Codex開発依頼」を編集' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(promptTrigger).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('dialog', { name: 'Prompt本文' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(promptTrigger).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: '「Codex開発依頼」からTrailを作成' }),
    ).toBeFocused();
    await promptTrigger.click();
    const popoverBox = await page
      .getByRole('dialog', { name: 'Prompt本文' })
      .boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(popoverBox!.x).toBeGreaterThanOrEqual(0);
    expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('link', { name: '「Codex開発依頼」からTrailを作成' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '「Codex開発依頼」を編集' }),
    ).toBeVisible();
    await page.goto('/runs/new?sourcePromptId=prompt-library-e2e');
    await expect(page.getByLabel('Prompt本文')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('creates repeatable Trails from one Prompt without duplicating the asset', async ({
    page,
  }) => {
    await page.goto('/prompts');
    await seedPromptLibraryInBrowser(page);
    await page.reload();

    await page
      .getByRole('link', { name: '「Codex開発依頼」からTrailを作成' })
      .click();
    await expect(page).toHaveURL(
      /\/runs\/new\?sourcePromptId=prompt-library-e2e/,
    );
    await expect(page.getByLabel('Prompt本文')).toHaveAttribute('readonly', '');
    await page.getByLabel('Trail名').fill('反復利用Trail 1');
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page).toHaveURL(/\/runs\/run-/);
    await expect(
      page.getByText('変更内容を確認して実装してください。'),
    ).toBeVisible();

    await page.goto('/runs/new?sourcePromptId=prompt-library-e2e');
    await page.reload();
    await page.getByLabel('Trail名').fill('反復利用Trail 2');
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page).toHaveURL(/\/runs\/run-/);

    const counts = await page.evaluate(async () => {
      const { createPromptTrailRuntime } =
        await import('/src/app/prompt-trail-runtime.ts');
      const runtime = createPromptTrailRuntime();
      try {
        await runtime.initialize();
        const { DEFAULT_PROJECT_ID } = await import('/src/domain/index.ts');
        return {
          prompts: (
            await runtime.repository.listActivePrompts(DEFAULT_PROJECT_ID)
          ).length,
          runs: (await runtime.repository.listActiveRuns(DEFAULT_PROJECT_ID))
            .length,
        };
      } finally {
        runtime.dispose();
      }
    });
    expect(counts).toEqual({ prompts: 1, runs: 2 });
  });

  test('keeps snapshots immutable, rejects deleted sources, and recovers a two-page stale write', async ({
    page,
    context,
  }) => {
    await page.goto('/prompts');
    await seedPromptLibraryInBrowser(page);
    await page.goto('/runs/new?sourcePromptId=prompt-library-e2e');
    await page.getByLabel('Trail名').fill('編集前Run A');
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page).toHaveURL(/\/runs\/run-/);
    const runAUrl = page.url();
    await expect(
      page.getByText('変更内容を確認して実装してください。'),
    ).toBeVisible();

    const stalePage = await context.newPage();
    await stalePage.goto('/runs/new?sourcePromptId=prompt-library-e2e');
    await stalePage.getByLabel('Trail名').fill('保持する競合draft');
    await stalePage.getByLabel('Trail種別').selectOption('review');

    const editorPage = await context.newPage();
    await editorPage.goto('/prompts/prompt-library-e2e/edit');
    await editorPage.getByLabel('Prompt本文').fill('編集後のPrompt本文');
    await editorPage.getByRole('button', { name: '保存' }).click();
    await expect(editorPage.getByText('Promptを更新しました。')).toBeVisible();

    await stalePage.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(
      stalePage.getByRole('button', { name: '最新のPromptを読み込む' }),
    ).toBeFocused();
    await expect(stalePage.getByLabel('Trail名')).toHaveValue(
      '保持する競合draft',
    );
    await stalePage
      .getByRole('button', { name: '最新のPromptを読み込む' })
      .click();
    await expect(stalePage.getByLabel('Prompt本文')).toHaveValue(
      '編集後のPrompt本文',
    );
    await expect(stalePage.getByLabel('Trail名')).toHaveValue(
      '保持する競合draft',
    );
    await stalePage.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(stalePage).toHaveURL(/\/runs\/run-/);
    await expect(stalePage.getByText('編集後のPrompt本文')).toBeVisible();

    await editorPage.goto('/prompts/prompt-library-e2e/edit');
    await editorPage.getByRole('button', { name: 'Promptを削除' }).click();
    await editorPage.getByRole('button', { name: '削除する' }).click();
    await page.goto(runAUrl);
    await expect(
      page.getByText('変更内容を確認して実装してください。'),
    ).toBeVisible();
    await page.goto('/runs/new?sourcePromptId=prompt-library-e2e');
    await expect(
      page.getByText('元のPromptは削除されたか、現在は利用できません。'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Trailを作成' }),
    ).toBeDisabled();
  });
});
