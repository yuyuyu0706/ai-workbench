import type { Page } from '@playwright/test';

export type BrowserCanonicalSampleSeedResult = {
  readonly status: 'seeded' | 'already-present' | 'conflict';
  readonly sampleRunId: string;
  readonly sampleRunUpdatedAt: string;
};

export async function seedCanonicalSampleDataInBrowser(
  page: Page,
): Promise<BrowserCanonicalSampleSeedResult> {
  return page.evaluate(async () => {
    const [{ createPromptTrailRuntime }, { sampleDataset, seedSampleData }] =
      await Promise.all([
        import('/src/app/prompt-trail-runtime.ts'),
        import('/src/sample-data/index.ts'),
      ]);

    const runtime = createPromptTrailRuntime();

    try {
      await runtime.initialize();
      const result = await seedSampleData(runtime.repository);

      return {
        status: result.status,
        sampleRunId: sampleDataset.run.id,
        sampleRunUpdatedAt: sampleDataset.run.updatedAt,
      };
    } finally {
      runtime.dispose();
    }
  });
}
