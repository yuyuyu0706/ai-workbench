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
// A fixed safeMarginPx (keeping the arrow clear of the popover's rounded
// corners) can exceed a narrow panel's own width/height once the panel is
// forced down to something like `calc(100vw - 2rem)` on a 320px viewport.
// When that happens, clampPopoverArrowOffset's safe range no longer
// contains the arrow's "true" target position, so it gets forced to
// whichever end is closest instead of tracking the trigger. Scaling the
// margin down per axis, relative to that axis's own panel dimension, keeps
// it a no-op at normal desktop sizes (where the panel is comfortably wider
// than safeMarginPx / ARROW_SAFE_MARGIN_PANEL_RATIO) while letting the
// arrow sit closer to the corner rather than mis-point at narrow widths.
const ARROW_SAFE_MARGIN_PANEL_RATIO = 0.08;

function effectiveSafeMargin(safeMarginPx: number, panelDimension: number) {
  return Math.min(safeMarginPx, panelDimension * ARROW_SAFE_MARGIN_PANEL_RATIO);
}

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
      effectiveSafeMargin(safeMarginPx, panelWidth),
    )}px`,
    [`${varPrefix}-y`]: `${clampPopoverArrowOffset(
      triggerCenterY - top,
      panelHeight,
      effectiveSafeMargin(safeMarginPx, panelHeight),
    )}px`,
    [`${varPrefix}-offset`]: `${arrowSizePx / 2}px`,
  } as CSSProperties;
}
