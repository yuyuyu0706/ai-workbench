import type { CSSProperties } from 'react';
import type { PopoverPositionResult } from './usePopoverPosition';

/**
 * Shared arrow-offset math for popovers positioned by `usePopoverPosition`
 * with the `right-start` / `left-start` / `bottom-start` placement set (see
 * `PromptLibraryPage`'s `PromptBodyPopover` and `RunStepSection`'s
 * `RunPopover`). Both consumers render a real `<span>` arrow whose position
 * along the popover's edge is computed here so the arrow stays aligned with
 * the trigger's vertical (or horizontal, for `bottom-start`) center, clamped
 * away from the popover's rounded corners.
 */
export function clampPopoverArrowOffset(
  value: number,
  size: number,
  safeMarginPx: number,
) {
  return Math.max(
    safeMarginPx,
    Math.min(value, Math.max(safeMarginPx, size - safeMarginPx)),
  );
}

/**
 * Builds the `--*-arrow-x` / `--*-arrow-y` / `--*-arrow-offset` custom
 * properties consumed by the placement-specific arrow CSS rules, given a
 * resolved `usePopoverPosition` result. `varPrefix` should include the
 * leading `--` (e.g. `--pt-prompt-body-arrow` or `--pt-run-popover-arrow`).
 */
export function buildPopoverArrowStyle<TId extends string>(
  position: PopoverPositionResult<TId>,
  {
    varPrefix,
    arrowSizePx,
    safeMarginPx,
  }: { varPrefix: string; arrowSizePx: number; safeMarginPx: number },
): CSSProperties {
  const { triggerRect, panelWidth, panelHeight, left, top } = position;
  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;
  return {
    [`${varPrefix}-x`]: `${clampPopoverArrowOffset(
      triggerCenterX - left,
      panelWidth,
      safeMarginPx,
    )}px`,
    [`${varPrefix}-y`]: `${clampPopoverArrowOffset(
      triggerCenterY - top,
      panelHeight,
      safeMarginPx,
    )}px`,
    [`${varPrefix}-offset`]: `${arrowSizePx / 2}px`,
  } as CSSProperties;
}
