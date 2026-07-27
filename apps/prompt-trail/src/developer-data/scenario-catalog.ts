import type { DeveloperDataScenario } from './developer-data-scenario';
import type { DeveloperDataScenarioId } from './scenario-ids';
import { denseScenario } from './scenarios/dense';
import { emptyScenario } from './scenarios/empty';
import { legacyCompatibleScenario } from './scenarios/legacy-compatible';
import { reuseReadyScenario } from './scenarios/reuse-ready';
import { standardScenario } from './scenarios/standard';

export const developerDataScenarios: readonly DeveloperDataScenario[] =
  Object.freeze([
    emptyScenario,
    standardScenario,
    reuseReadyScenario,
    denseScenario,
    legacyCompatibleScenario,
  ]);

export function getDeveloperDataScenario(
  id: DeveloperDataScenarioId,
): DeveloperDataScenario {
  const scenario = developerDataScenarios.find(
    (candidate) => candidate.id === id,
  );
  if (scenario === undefined)
    throw new Error(`Unknown developer data scenario: ${id}`);
  return scenario;
}
