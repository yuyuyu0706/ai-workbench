import { DEFAULT_PROJECT_ID, type Link, type Run } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type ResumableAgentRun = {
  readonly run: Run;
  readonly link: Link;
  readonly promptTrailRunId: string;
  readonly runId: string | null;
};

/**
 * Finds in-progress agent-step runs a viewer can resume polling for: every
 * active Run whose `status` is `in-progress` and that has one `execution` /
 * `external` Link. `runId` is the Link's `externalId` when the GitHub run
 * has already been resolved, otherwise `null` — callers query
 * `fetchAgentStatus` by `promptTrailRunId` (the Link's `title`) in that case.
 */
export async function findResumableRuns(
  repository: PromptTrailRepository,
): Promise<readonly ResumableAgentRun[]> {
  const runs = await repository.listActiveRuns(DEFAULT_PROJECT_ID);
  const inProgressRuns = runs.filter((run) => run.status === 'in-progress');

  const resumable: ResumableAgentRun[] = [];
  for (const run of inProgressRuns) {
    const links = await repository.listActiveLinks(run.id);
    const executionLink = links.find(
      (link) => link.role === 'execution' && link.type === 'external',
    );
    if (executionLink === undefined) continue;

    resumable.push({
      run,
      link: executionLink,
      promptTrailRunId: executionLink.title ?? '',
      runId: executionLink.externalId,
    });
  }

  return resumable;
}
