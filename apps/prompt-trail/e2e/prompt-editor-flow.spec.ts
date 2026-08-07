import { expect, type Page, test } from '@playwright/test';

import type { PromptId, UtcDateTimeString } from '../src/domain';
import { expectNoHorizontalOverflow } from './support/layout';

async function seedEditablePrompts(page: Page) {
  await page.evaluate(async () => {
    const [{ createPromptTrailRuntime }, domain] = await Promise.all([
      import('/src/app/prompt-trail-runtime.ts'),
      import('/src/domain/index.ts'),
    ]);
    const runtime = createPromptTrailRuntime();
    const older = '2026-07-01T00:00:00.000Z' as UtcDateTimeString;
    const newer = '2026-07-02T00:00:00.000Z' as UtcDateTimeString;
    try {
      await runtime.initialize();
      await runtime.repository.saveProject(domain.createDefaultProject(older));
      for (const [id, title, updatedAt] of [
        ['prompt-edit-e2e', '編集対象Prompt', older],
        ['prompt-newer-e2e', '更新日時が新しいPrompt', newer],
      ] as const)
        await runtime.repository.savePrompt({
          id: id as PromptId,
          createdAt: older,
          updatedAt,
          deletedAt: null,
          scope: 'project',
          projectId: domain.DEFAULT_PROJECT_ID,
          title,
          body: `${title}の本文`,
          kind: 'other',
          status: 'active',
          tags: [],
        });
    } finally {
      runtime.dispose();
    }
  });
}

test.describe('Prompt Editor flow', () => {
  test('supports direct access, reload, creation, and one-time success notice', async ({
    page,
  }) => {
    await page.goto('/prompts/new');
    await expect(
      page.getByRole('heading', { name: 'Promptを新規登録' }),
    ).toBeVisible();
    await page.reload();
    await page.getByLabel('タイトル').fill('E2E新規Prompt');
    await page
      .getByRole('textbox', { name: 'Prompt本文' })
      .fill('  Markdown\n  本文');
    await page.getByLabel('種別').selectOption('codex-request');
    await page
      .getByLabel('Promptの内容')
      .getByRole('button', { name: '保存' })
      .click();

    await expect(page).toHaveURL(/\/prompts$/);
    await expect(page.getByText('Promptを登録しました。')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Prompt一覧' })).toContainText(
      'E2E新規Prompt',
    );
    await page.reload();
    await expect(page.getByText('Promptを登録しました。')).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Prompt一覧' })).toContainText(
      'E2E新規Prompt',
    );
  });

  test('supports direct edit access, reload, update, and updatedAt ordering', async ({
    page,
  }) => {
    await page.goto('/prompts');
    await seedEditablePrompts(page);
    await page.goto('/prompts/prompt-edit-e2e/edit');
    await expect(page.getByLabel('タイトル')).toHaveValue('編集対象Prompt');
    await page.reload();
    await page.getByLabel('タイトル').fill('編集済みPrompt');
    await page
      .getByRole('textbox', { name: 'Prompt本文' })
      .fill('編集後の本文');
    await page.getByLabel('種別').selectOption('design-review');
    await page
      .getByLabel('Promptの内容')
      .getByRole('button', { name: '保存' })
      .click();

    await expect(page.getByText('Promptを更新しました。')).toBeVisible();
    const rows = page
      .getByRole('table', { name: 'Prompt一覧' })
      .locator('tbody tr');
    await expect(rows.first()).toContainText('編集済みPrompt');
    await rows
      .first()
      .getByRole('button', { name: '「編集済みPrompt」のPrompt本文を表示' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Prompt本文' }),
    ).toContainText('編集後の本文');
  });

  test('confirms or cancels soft deletion, excludes the Prompt, and shows notice once', async ({
    page,
  }) => {
    await page.goto('/prompts');
    await seedEditablePrompts(page);
    await page.goto('/prompts/prompt-edit-e2e/edit');
    await page.getByRole('button', { name: 'Promptを削除' }).click();
    await expect(page.getByRole('button', { name: '削除する' })).toBeFocused();
    await expect(page.getByText(/編集対象Prompt.*削除しますか/)).toBeVisible();
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(
      page.getByRole('button', { name: 'Promptを削除' }),
    ).toBeFocused();

    await page.getByRole('button', { name: 'Promptを削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await expect(page).toHaveURL(/\/prompts$/);
    await expect(page.getByText('Promptを削除しました。')).toBeVisible();
    await expect(
      page
        .getByRole('table', { name: 'Prompt一覧' })
        .getByText('編集対象Prompt'),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Promptを削除しました。')).toHaveCount(0);

    await page.goto('/prompts/prompt-edit-e2e/edit');
    await expect(page.getByText('このPromptは編集できません。')).toBeVisible();
  });

  test('keeps delete confirmation states within a 320px viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/prompts');
    await seedEditablePrompts(page);
    await page.goto('/prompts/prompt-edit-e2e/edit');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Promptを削除' }).click();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Developer Tools' }).click();
    await page
      .getByRole('combobox', { name: 'Target' })
      .selectOption('prompt-editor-delete');
    await page
      .getByRole('combobox', { name: 'State' })
      .selectOption('delete-failure');
    await page.getByRole('button', { name: '適用' }).click();
    await expect(page.getByText(/削除に失敗しました/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('works without horizontal overflow at 320px and keeps a New Trail Prompt active', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/prompts/new');
    await expectNoHorizontalOverflow(page);
    await page.getByLabel('タイトル').fill('320px Prompt');
    await page
      .getByRole('textbox', { name: 'Prompt本文' })
      .fill('320pxでも操作できる本文');
    await page.getByLabel('種別').selectOption('other');
    await expectNoHorizontalOverflow(page);

    await page.goto('/runs/new');
    await page
      .getByLabel('Prompt本文')
      .fill('New Trailから保存されるActive Prompt');
    await page.getByRole('button', { name: 'Trailを作成' }).click();
    await expect(page).toHaveURL(/\/runs\/run-/);
    await page.goto('/prompts');
    await expect(page.getByRole('table', { name: 'Prompt一覧' })).toContainText(
      'New Trailから保存されるActive Prompt',
    );
  });
});
