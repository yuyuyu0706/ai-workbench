import type { DeveloperUiStateOverride } from './catalog';
import type { DeveloperUiStateSnapshot } from './store';

type DeveloperUiStateTarget = DeveloperUiStateOverride['target'];

export type DeveloperUiStateForTarget<Target extends DeveloperUiStateTarget> =
  Extract<DeveloperUiStateOverride, { target: Target }>['state'];

export function selectActiveDeveloperUiState<
  Target extends DeveloperUiStateTarget,
>(
  snapshot: DeveloperUiStateSnapshot | null,
  target: Target,
): DeveloperUiStateForTarget<Target> | null {
  const override = snapshot?.activeOverride;
  return (
    override?.target === target ? override.state : null
  ) as DeveloperUiStateForTarget<Target> | null;
}
