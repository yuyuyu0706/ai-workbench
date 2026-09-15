import { useMemo, useRef, type RefObject } from 'react';
import { ResponsivePopover } from '../components/ResponsivePopover';
import type {
  PopoverMeasurements,
  PopoverPlacementOption,
} from '../components/usePopoverPosition';

// Mirrors PromptLibraryPage's PromptBodyPopover placement set: opens beside
// the trigger, vertically aligned to it ('right-start'), falling back to the
// other side when the viewport is too narrow ('left-start'), and finally
// below the trigger, clamped to the viewport, when there isn't room on
// either side ('bottom-start').
type RunPopoverPlacement = 'right-start' | 'left-start' | 'bottom-start';

function runPopoverSideTop(m: PopoverMeasurements) {
  const maxTop = Math.max(
    m.margin,
    m.viewportHeight - m.panelHeight - m.margin,
  );
  return Math.max(m.margin, Math.min(m.triggerRect.top, maxTop));
}

// Per the Trail Detail mockup, the default 'right-start' placement opens
// up-and-to-the-right of its trigger icon rather than directly beside it at
// the same vertical level. The popover's bottom edge should sit a small gap
// above the trigger icon's top edge (no overlap) vertically. Horizontally,
// the popover is anchored to the trigger's *left* edge (rather than its
// right edge) so the trigger icon's horizontal center reliably lands well
// inside the arrow's clamped safe range (RUN_POPOVER_ARROW_SAFE_MARGIN_PX
// below) instead of past the popover's own left edge. These are quick
// tunable knobs (not a precise formula) — tune by eye in the browser if the
// app's icon size or spacing changes.
const RUN_POPOVER_VERTICAL_GAP_PX = 8;
const RUN_POPOVER_HORIZONTAL_OFFSET_PX = 4;

function runPopoverRightStartTop(m: PopoverMeasurements) {
  const desiredTop =
    m.triggerRect.top - m.panelHeight - RUN_POPOVER_VERTICAL_GAP_PX;
  const maxTop = Math.max(
    m.margin,
    m.viewportHeight - m.panelHeight - m.margin,
  );
  return Math.max(m.margin, Math.min(desiredTop, maxTop));
}

// The result popover (`pt-run-popover--wide`) uses a larger horizontal
// offset than the default so its wider body opens mostly to the left of
// the trigger icon instead of extending far to the right of it. The
// arrow's horizontal position is derived from `triggerCenterX - left` (see
// buildPopoverArrowStyle), so it keeps pointing at whichever icon was
// clicked regardless of this offset.
export const RUN_POPOVER_WIDE_HORIZONTAL_OFFSET_PX = 72;

function buildRunPopoverPlacements(
  horizontalOffsetPx: number,
): readonly PopoverPlacementOption<RunPopoverPlacement>[] {
  return [
    {
      id: 'right-start',
      // The popover's left edge sits at triggerRect.left - offsetPx (see
      // place() below), so the room needed to its right is measured from
      // that same anchor rather than from triggerRect.right.
      fits: (m) =>
        m.viewportWidth - (m.triggerRect.left - horizontalOffsetPx) >=
        m.panelWidth + m.gap,
      place: (m) => ({
        left: m.triggerRect.left - horizontalOffsetPx,
        top: runPopoverRightStartTop(m),
      }),
    },
    {
      id: 'left-start',
      fits: (m) => m.triggerRect.left >= m.panelWidth + m.gap,
      place: (m) => ({
        left: m.triggerRect.left - m.panelWidth - m.gap,
        top: runPopoverSideTop(m),
      }),
    },
    {
      id: 'bottom-start',
      fits: () => true,
      place: (m) => {
        const maxLeft = Math.max(
          m.margin,
          m.viewportWidth - m.panelWidth - m.margin,
        );
        const left = Math.max(m.margin, Math.min(m.triggerRect.left, maxLeft));
        const top = Math.min(
          m.triggerRect.bottom + m.gap,
          Math.max(m.margin, m.viewportHeight - m.panelHeight - m.margin),
        );
        return { left, top };
      },
    },
  ];
}

const RUN_POPOVER_GAP_PX = 8;
const RUN_POPOVER_ARROW_SIZE_PX = 12;

// Keep the arrow clear of the popover's rounded corners, mirroring
// PromptLibraryPage's PROMPT_BODY_POPOVER_ARROW_SAFE_MARGIN_PX.
const RUN_POPOVER_ARROW_SAFE_MARGIN_PX = 16;

export function RunPopover({
  triggerRef,
  className,
  horizontalOffsetPx = RUN_POPOVER_HORIZONTAL_OFFSET_PX,
  title,
  onClose,
  sheetHeader = true,
  children,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  className?: string;
  horizontalOffsetPx?: number;
  /** Heading shown in the narrow-viewport bottom sheet, for context. */
  title: string;
  onClose: () => void;
  /**
   * Set to `false` when `children` already render their own header/close
   * button, so the narrow-viewport sheet doesn't show a duplicate one.
   */
  sheetHeader?: boolean;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const placements = useMemo(
    () => buildRunPopoverPlacements(horizontalOffsetPx),
    [horizontalOffsetPx],
  );
  return (
    <ResponsivePopover
      triggerRef={triggerRef}
      panelRef={panelRef}
      open={true}
      placements={placements}
      gap={RUN_POPOVER_GAP_PX}
      arrow={{
        varPrefix: '--pt-run-popover-arrow',
        sizePx: RUN_POPOVER_ARROW_SIZE_PX,
        safeMarginPx: RUN_POPOVER_ARROW_SAFE_MARGIN_PX,
        className: 'pt-run-popover__arrow',
      }}
      panelClassName={
        className ? `pt-run-popover ${className}` : 'pt-run-popover'
      }
      scrollClassName="pt-run-popover__scroll"
      title={title}
      sheetHeader={sheetHeader}
      onClose={onClose}
      closeOnEscape={false}
    >
      {children}
    </ResponsivePopover>
  );
}
