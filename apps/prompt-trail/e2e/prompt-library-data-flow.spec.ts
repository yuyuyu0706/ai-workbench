import { expect, type Page, test } from '@playwright/test';

import type { PromptId, UtcDateTimeString } from '../src/domain';

import { expectNoHorizontalOverflow } from './support/layout';
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

test.describe('Prompt Library data flow', () => {
  test('supports direct access, repository data, search, and reload', async ({
    page,
  }) => {
    await page.goto('/prompts');
    await expect(
      page.getByText('Repositoryに表示できるPromptがまだありません。'),
    ).toBeVisible();

    await seedPromptLibraryInBrowser(page);
    await page.reload();

    await expect(
      page.getByRole('heading', { level: 2, name: '保存済みPrompt' }),
    ).toBeVisible();
    const promptList = page.getByRole('list', { name: 'Prompt一覧' });
    await expect(
      promptList.getByRole('heading', { name: 'Codex開発依頼' }),
    ).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Promptを検索' });
    await search.fill('  codex  ');
    await expect(promptList.getByRole('listitem')).toHaveCount(1);

    await search.fill('一致しない検索条件');
    await expect(
      page.getByText('検索条件に一致するPromptがありません。'),
    ).toBeVisible();

    await search.fill('');
    await expect(promptList.getByRole('listitem')).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Codex開発依頼' }),
    ).toBeVisible();
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
