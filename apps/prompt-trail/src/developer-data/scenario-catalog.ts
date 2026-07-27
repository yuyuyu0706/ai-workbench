import type { DeveloperDataScenario } from './developer-data-scenario';
import {
  DEVELOPER_DATA_SCENARIO_IDS,
  type DeveloperDataScenarioId,
} from './scenario-ids';
import { denseScenario } from './scenarios/dense';
import { emptyScenario } from './scenarios/empty';
import { legacyCompatibleScenario } from './scenarios/legacy-compatible';
import { reuseReadyScenario } from './scenarios/reuse-ready';
import { standardScenario } from './scenarios/standard';

const scenarioById: Readonly<
  Record<DeveloperDataScenarioId, DeveloperDataScenario>
> = {
  empty: emptyScenario,
  standard: standardScenario,
  'reuse-ready': reuseReadyScenario,
  dense: denseScenario,
  'legacy-compatible': legacyCompatibleScenario,
};

export const developerDataScenarios: readonly DeveloperDataScenario[] =
  DEVELOPER_DATA_SCENARIO_IDS.map((scenarioId) => scenarioById[scenarioId]);

export function getDeveloperDataScenario(
  scenarioId: DeveloperDataScenarioId,
): DeveloperDataScenario {
  return scenarioById[scenarioId];
}
