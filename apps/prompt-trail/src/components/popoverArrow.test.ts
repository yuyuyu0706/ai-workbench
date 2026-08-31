import { describe, expect, it } from 'vitest';
import { buildPopoverArrowStyle } from './popoverArrow';
import type { PopoverPositionResult } from './usePopoverPosition';

function makePosition(
  overrides: Partial<PopoverPositionResult<'p'>> &
    Pick<PopoverPositionResult<'p'>, 'triggerRect'>,
): PopoverPositionResult<'p'> {
  return {
    placement: 'p',
    left: 0,
    top: 0,
    panelWidth: 300,
    panelHeight: 200,
    ...overrides,
  };
}

describe('buildPopoverArrowStyle', () => {
  it('keeps the fixed 16px safe margin on a panel wide enough for it', () => {
    // triggerCenterX - left = 300, which the fixed 16px margin clamps to
    // panelWidth - 16 = 284.
    const position = makePosition({
      triggerRect: { left: 292, width: 16 } as DOMRect,
      panelWidth: 300,
      left: 0,
    });
    const style = buildPopoverArrowStyle(position, {
      varPrefix: '--x',
      arrowSizePx: 12,
      safeMarginPx: 16,
    });
    expect(style['--x-x' as keyof typeof style]).toBe('284px');
  });

  it('shrinks the safe margin on a panel narrower than safeMarginPx / 0.08 so the arrow keeps tracking the true trigger position', () => {
    // A 120px-wide panel forces panelWidth * 0.08 = 9.6px, below the fixed
    // 16px margin, so the effective margin shrinks to 9.6px instead of
    // clamping the arrow 16px in from the edge.
    const position = makePosition({
      triggerRect: { left: 108, width: 4 } as DOMRect,
      panelWidth: 120,
      left: 0,
    });
    const style = buildPopoverArrowStyle(position, {
      varPrefix: '--x',
      arrowSizePx: 12,
      safeMarginPx: 16,
    });
    // triggerCenterX - left = 110, within the scaled bound of
    // panelWidth - 9.6 = 110.4, so it tracks the trigger exactly instead of
    // the 104px the fixed 16px margin (panelWidth - 16) would have forced.
    expect(style['--x-x' as keyof typeof style]).toBe('110px');
  });

  it('never widens the margin beyond the fixed safeMarginPx', () => {
    const position = makePosition({
      triggerRect: { left: 10000, width: 10 } as DOMRect,
      panelWidth: 4000,
      left: 0,
    });
    const style = buildPopoverArrowStyle(position, {
      varPrefix: '--x',
      arrowSizePx: 12,
      safeMarginPx: 16,
    });
    expect(style['--x-x' as keyof typeof style]).toBe('3984px');
  });
});
