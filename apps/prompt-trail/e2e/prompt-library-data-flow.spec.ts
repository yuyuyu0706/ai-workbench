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

async function expectArrowTracksTrigger(
  trigger: ReturnType<Page['getByRole']>,
  popover: ReturnType<Page['getByRole']>,
) {
  const [triggerBox, popoverBox, placement, arrowX, arrowY] = await Promise.all(
    [
      trigger.boundingBox(),
      popover.boundingBox(),
      popover.getAttribute('data-placement'),
      popover.evaluate((element) =>
        Number.parseFloat(
          getComputedStyle(element).getPropertyValue(
            '--pt-prompt-body-arrow-x',
          ),
        ),
      ),
      popover.evaluate((element) =>
        Number.parseFloat(
          getComputedStyle(element).getPropertyValue(
            '--pt-prompt-body-arrow-y',
          ),
        ),
      ),
    ],
  );
  expect(triggerBox).not.toBeNull();
  expect(popoverBox).not.toBeNull();
  if (placement === 'bottom-start') {
    expect(popoverBox!.x + arrowX).toBeCloseTo(
      triggerBox!.x + triggerBox!.width / 2,
      0,
    );
  } else {
    expect(popoverBox!.y + arrowY).toBeCloseTo(
      triggerBox!.y + triggerBox!.height / 2,
      0,
    );
  }
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
    await expect(search).toHaveCSS('font-weight', '400');
    await expect(page.getByText('Promptを検索', { exact: true })).toHaveCSS(
      'font-weight',
      '700',
    );
    await expect(page.getByText('全2件を表示')).toBeVisible();
    const nameHeader = promptTable.getByRole('columnheader').first();
    const updatedHeader = promptTable.getByRole('columnheader', {
      name: '更新日時',
    });
    await expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    await expect(updatedHeader).toHaveAttribute('aria-sort', 'descending');
    await nameHeader
      .getByRole('button', { name: 'Prompt名を昇順に並べ替え' })
      .click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await nameHeader
      .getByRole('button', { name: 'Prompt名を降順に並べ替え' })
      .click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    await nameHeader
      .getByRole('button', { name: '更新日時降順へ戻す' })
      .click();
    await expect(updatedHeader).toHaveAttribute('aria-sort', 'descending');
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
    await expect(
      popover.getByRole('link', { name: '「Codex開発依頼」を編集' }),
    ).toHaveAttribute('href', '/prompts/prompt-library-e2e/edit');
    await expect(popover.getByText('Promptを編集する')).toHaveCount(1);
    const editAction = popover.getByRole('link', {
      name: '「Codex開発依頼」を編集',
    });
    await expect(editAction).toHaveText('');
    await expect(editAction.locator('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await editAction.hover();
    await expect(
      popover.getByRole('tooltip', { name: 'Promptを編集する' }),
    ).toHaveCSS('opacity', '1');
    await expect(
      popover.getByRole('tooltip', { name: '閉じる' }),
    ).toBeAttached();
    if (testInfo.project.name === 'chromium-desktop') {
      await expect(popover).toHaveAttribute(
        'data-placement',
        /^(right|left)-start$/,
      );
      const triggerRect = await projectTrigger.boundingBox();
      const popoverRect = await popover.boundingBox();
      expect(triggerRect).not.toBeNull();
      expect(popoverRect).not.toBeNull();
      expect(popoverRect!.width).toBeGreaterThanOrEqual(360);
      expect(popoverRect!.width).toBeLessThanOrEqual(400);
      const placement = await popover.getAttribute('data-placement');
      if (placement === 'right-start')
        expect(popoverRect!.x).toBeGreaterThanOrEqual(
          triggerRect!.x + triggerRect!.width,
        );
      else
        expect(popoverRect!.x + popoverRect!.width).toBeLessThanOrEqual(
          triggerRect!.x,
        );
    }
    const promptHeading = promptTable.getByRole('columnheader', {
      name: 'Prompt',
      exact: true,
    });
    const actionHeading = promptTable.getByRole('columnheader', {
      name: '操作',
    });
    await expect(promptHeading).toHaveCSS('text-align', 'center');
    await expect(actionHeading).toHaveCSS('text-align', 'center');
    await expect(shortRow.locator('.pt-prompt-table__prompt-cell')).toHaveCSS(
      'text-align',
      'center',
    );
    await expect(shortRow.locator('.pt-prompt-table__action-cell')).toHaveCSS(
      'text-align',
      'center',
    );
    await editAction.click();
    await expect(page).toHaveURL(/\/prompts\/prompt-library-e2e\/edit$/);
    await page.goBack();
    await expect(promptTable).toBeVisible();
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
      page.getByRole('button', { name: 'Prompt名を昇順に並べ替え' }),
    ).toBeFocused();
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
    const mobilePopover = page.getByRole('dialog', { name: 'Prompt本文' });
    await expect(
      mobilePopover.getByRole('link', { name: '「Codex開発依頼」を編集' }),
    ).toBeVisible();
    await expect(
      mobilePopover.getByRole('button', { name: 'Prompt本文を閉じる' }),
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

  test('keeps all Prompt Library actions operable at a 200% zoom equivalent viewport', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // A 1440 × 1000 browser surface at 200% zoom exposes a 720 × 500 CSS viewport.
    await page.setViewportSize({ width: 720, height: 500 });
    await page.goto('/prompts');
    await seedPromptLibraryInBrowser(page);
    await seedGlobalPromptInBrowser(page);
    await page.reload();

    await expectNoHorizontalOverflow(page);
    const projectFilter = page.getByRole('combobox', { name: 'プロジェクト' });
    const search = page.getByRole('searchbox', { name: 'Promptを検索' });
    await projectFilter.selectOption('project');
    await search.fill('Codex');
    await expect(page.getByText('全2件中 1件を表示')).toBeVisible();
    await page.getByRole('button', { name: '条件をクリア' }).click();

    const tableRegion = page.getByRole('region', {
      name: 'Prompt一覧テーブル',
    });
    expect(
      await tableRegion.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('button', { name: 'Prompt名を昇順に並べ替え' })
      .click();

    const promptTrigger = page.getByRole('button', {
      name: '「Codex開発依頼」のPrompt本文を表示',
    });
    await promptTrigger.click();
    const popover = page.getByRole('dialog', { name: 'Prompt本文' });
    await expect(popover).toBeVisible();
    await popover
      .getByRole('button', { name: '「Codex開発依頼」のPrompt本文をコピー' })
      .click();
    await expect(popover.getByText('コピーしました')).toBeVisible();
    await page.getByRole('button', { name: 'Prompt本文を閉じる' }).click();
    await expect(promptTrigger).toBeFocused();

    await promptTrigger.click();
    const editLink = popover.getByRole('link', {
      name: '「Codex開発依頼」を編集',
    });
    await expect(editLink).toBeVisible();
    await editLink.click();
    await expect(page).toHaveURL(/\/prompts\/prompt-library-e2e\/edit$/);
    await page.goBack();
    await expect(page.getByRole('table', { name: 'Prompt一覧' })).toBeVisible();
    const trailLink = page.getByRole('link', {
      name: '「Codex開発依頼」からTrailを作成',
    });
    await trailLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      /\/runs\/new\?sourcePromptId=prompt-library-e2e$/,
    );
    await expectNoHorizontalOverflow(page);
  });

  test('hides icon tooltips after mouse click blur contract and shows them for keyboard focus', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto('/prompts');
    await seedPromptLibraryInBrowser(page);
    await page.reload();

    const heading = page.getByRole('heading', {
      level: 1,
      name: 'Prompt Library',
    });
    const trailAction = page.getByRole('link', {
      name: '「Codex開発依頼」からTrailを作成',
    });
    const trailTooltip = page.getByRole('tooltip', { name: 'Trailを作成' });
    await trailAction.hover();
    await expect(trailTooltip).toHaveCSS('opacity', '1');
    await heading.hover();
    await expect(trailTooltip).toHaveCSS('opacity', '0');

    await page
      .getByRole('button', { name: '「Codex開発依頼」のPrompt本文を表示' })
      .click();
    const popover = page.getByRole('dialog', { name: 'Prompt本文' });
    await expect(popover).toBeVisible();

    const inlineEdit = popover.getByRole('button', {
      name: '「Codex開発依頼」のPrompt本文を編集',
    });
    const wholeEdit = popover.getByRole('link', {
      name: '「Codex開発依頼」を編集',
    });
    const copy = popover.getByRole('button', {
      name: '「Codex開発依頼」のPrompt本文をコピー',
    });
    const close = popover.getByRole('button', { name: 'Prompt本文を閉じる' });
    const inlineEditTooltip = popover.getByRole('tooltip', {
      name: 'Prompt本文を編集',
    });
    const wholeEditTooltip = popover.getByRole('tooltip', {
      name: 'Promptを編集する',
    });
    const copyTooltip = popover.getByRole('tooltip', {
      name: 'Prompt本文をコピー',
    });
    const closeTooltip = popover.getByRole('tooltip', { name: '閉じる' });

    await inlineEdit.hover();
    await expect(inlineEditTooltip).toHaveCSS('opacity', '1');
    await wholeEdit.hover();
    await expect(inlineEditTooltip).toHaveCSS('opacity', '0');
    await expect(wholeEditTooltip).toHaveCSS('opacity', '1');
    await close.hover();
    await expect(wholeEditTooltip).toHaveCSS('opacity', '0');
    await expect(closeTooltip).toHaveCSS('opacity', '1');
    await copy.hover();
    await expect(closeTooltip).toHaveCSS('opacity', '0');
    await expect(copyTooltip).toHaveCSS('opacity', '1');

    await copy.click();
    await expect(copy).toBeFocused();
    await expect(popover.getByText('コピーしました')).toBeVisible();
    await heading.hover();
    await expect(copyTooltip).toHaveCSS('opacity', '0');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      '変更内容を確認して実装してください。',
    );

    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await expect(closeTooltip).toHaveCSS('opacity', '1');
    await page.keyboard.press('Shift+Tab');
    await expect(copy).toBeFocused();
    await expect(copyTooltip).toHaveCSS('opacity', '1');
  });

  test('saves Prompt body edits across desktop, 320px, and 200% zoom viewports', async ({
    page,
  }) => {
    for (const [label, viewport] of [
      ['desktop', { width: 1000, height: 700 }],
      ['320px', { width: 320, height: 640 }],
      ['200% zoom equivalent', { width: 720, height: 500 }],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto('/prompts');
      await seedPromptLibraryInBrowser(page);
      await page.reload();
      await expectNoHorizontalOverflow(page);

      const trigger = page.getByRole('button', {
        name: '「Codex開発依頼」のPrompt本文を表示',
      });
      await trigger.click();
      const popover = page.getByRole('dialog', { name: 'Prompt本文' });
      await expect(popover).toBeVisible();
      await popover
        .getByRole('button', { name: '「Codex開発依頼」のPrompt本文を編集' })
        .click();
      await popover
        .getByRole('textbox', { name: 'Prompt本文' })
        .fill(`E2E更新本文 ${label}`);
      await popover.getByRole('button', { name: '保存' }).click();
      await expect(page.getByText('Prompt本文を更新しました。')).toBeVisible();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await expect(popover).toContainText(`E2E更新本文 ${label}`);
      await page.getByRole('button', { name: 'Prompt本文を閉じる' }).click();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('guards the Prompt body popover full-edit link until discard is confirmed', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto('/prompts');
    await seedPromptLibraryInBrowser(page);
    await page.reload();

    await page
      .getByRole('button', { name: '「Codex開発依頼」のPrompt本文を表示' })
      .click();
    const popover = page.getByRole('dialog', { name: 'Prompt本文' });
    await expect(popover).toBeVisible();
    await popover
      .getByRole('button', { name: '「Codex開発依頼」のPrompt本文を編集' })
      .click();
    const textbox = popover.getByRole('textbox', { name: 'Prompt本文' });
    await textbox.fill('破棄確認のためのdraft');
    const fullEditLink = popover.getByRole('link', {
      name: '「Codex開発依頼」を編集',
    });

    await fullEditLink.click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expect(popover.getByRole('alert')).toContainText(
      '編集中のPrompt本文を破棄しますか？',
    );
    await expect(
      popover.getByRole('button', { name: '編集を続ける' }),
    ).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(popover.getByRole('alert')).toBeHidden();
    await expect(textbox).toBeFocused();
    await expect(page).toHaveURL(/\/prompts$/);

    await fullEditLink.click();
    await popover.getByRole('button', { name: '編集を続ける' }).click();
    await expect(textbox).toBeFocused();
    await expect(page).toHaveURL(/\/prompts$/);

    await fullEditLink.click();
    await popover.getByRole('button', { name: '破棄する' }).click();
    await expect(page).toHaveURL(/\/prompts\/prompt-library-e2e\/edit$/);
  });

  test('guards global navigation while a Prompt body draft is dirty', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto('/prompts');
    await seedPromptLibraryInBrowser(page);
    await page.reload();

    await page
      .getByRole('button', { name: '「Codex開発依頼」のPrompt本文を表示' })
      .click();
    const popover = page.getByRole('dialog', { name: 'Prompt本文' });
    await popover
      .getByRole('button', { name: '「Codex開発依頼」のPrompt本文を編集' })
      .click();
    const textbox = popover.getByRole('textbox', { name: 'Prompt本文' });
    await textbox.fill('Global Navigation guard draft');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expect(popover.getByRole('alert')).toContainText(
      '編集中のPrompt本文を破棄しますか？',
    );
    await popover.getByRole('button', { name: '編集を続ける' }).click();
    await expect(textbox).toBeFocused();

    await page.getByRole('link', { name: 'はじめに' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await popover.getByRole('button', { name: '破棄する' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('keeps the Prompt body popover arrow connected after clamp and edit resize', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 720, height: 360 });
    await page.goto('/prompts');
    await seedGlobalPromptInBrowser(page);
    await page.reload();

    const tableRegion = page.getByRole('region', {
      name: 'Prompt一覧テーブル',
    });
    await tableRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const trigger = page.getByRole('button', {
      name: '「Global障害分析」のPrompt本文を表示',
    });
    await trigger.click();
    const popover = page.getByRole('dialog', { name: 'Prompt本文' });
    await expect(popover).toBeVisible();

    await expectArrowTracksTrigger(trigger, popover);
    await popover
      .getByRole('button', { name: '「Global障害分析」のPrompt本文を編集' })
      .click();
    await expect(
      popover.getByRole('textbox', { name: 'Prompt本文' }),
    ).toBeVisible();
    await expectArrowTracksTrigger(trigger, popover);
    await popover.getByRole('textbox', { name: 'Prompt本文' }).fill(' ');
    await popover.getByRole('button', { name: '保存' }).click();
    await expect(popover.getByRole('alert')).toContainText(
      'Prompt本文を入力してください。',
    );
    await expectArrowTracksTrigger(trigger, popover);
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
