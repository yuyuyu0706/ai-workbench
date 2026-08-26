import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

/**
 * Measurements available to a placement's `fits`/`place` functions. All
 * distances are in viewport (client) pixels, matching
 * `Element.getBoundingClientRect()`.
 */
export type PopoverMeasurements = {
  readonly triggerRect: DOMRect;
  readonly panelWidth: number;
  readonly panelHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly margin: number;
  readonly gap: number;
};

export type PopoverPlacementResult = {
  readonly left: number;
  readonly top: number;
};

/**
 * One candidate placement. The hook tries placements in the order given and
 * uses the first whose `fits` returns true. The last placement in the list
 * should normally return `true` from `fits` unconditionally so there is
 * always a usable (viewport-clamped) fallback.
 */
export type PopoverPlacementOption<TId extends string = string> = {
  readonly id: TId;
  readonly fits: (measurements: PopoverMeasurements) => boolean;
  readonly place: (measurements: PopoverMeasurements) => PopoverPlacementResult;
};

export type PopoverPositionResult<TId extends string = string> = {
  readonly placement: TId;
  readonly left: number;
  readonly top: number;
  readonly panelWidth: number;
  readonly panelHeight: number;
  readonly triggerRect: DOMRect;
};

export type PopoverPositionState<TId extends string = string> = {
  readonly position: PopoverPositionResult<TId> | null;
  /**
   * Schedules a recomputation on the next animation frame. Callers only
   * need this after a state change that may resize or reposition the panel
   * outside of what `ResizeObserver`/scroll/resize listeners already catch
   * (e.g. switching modes before the panel has actually resized).
   */
  readonly scheduleUpdate: () => void;
};

const DEFAULT_MARGIN_PX = 16;
const DEFAULT_GAP_PX = 12;

/**
 * Computes a popover's on-screen position by measuring the trigger and the
 * panel's *actual* rendered size (never an assumed/hardcoded size), and
 * picks a placement from a caller-supplied preference list, falling back to
 * whichever option fits (or, failing that, the last option, clamped to the
 * viewport).
 *
 * Positioning runs in `useLayoutEffect` so it is resolved before paint, and
 * is re-run whenever the panel resizes (via `ResizeObserver`) or the window
 * scrolls/resizes while the popover is open.
 */
export function usePopoverPosition<TId extends string>({
  triggerRef,
  panelRef,
  open,
  placements,
  margin = DEFAULT_MARGIN_PX,
  gap = DEFAULT_GAP_PX,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  open: boolean;
  placements: readonly PopoverPlacementOption<TId>[];
  margin?: number;
  gap?: number;
}): PopoverPositionState<TId> {
  const [position, setPosition] = useState<PopoverPositionResult<TId> | null>(
    null,
  );
  const lastSignatureRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (trigger === null || panel === null || placements.length === 0) return;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const measurements: PopoverMeasurements = {
      triggerRect,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      margin,
      gap,
    };
    const chosen =
      placements.find((option) => option.fits(measurements)) ??
      placements[placements.length - 1];
    const { left, top } = chosen.place(measurements);
    const next: PopoverPositionResult<TId> = {
      placement: chosen.id,
      left,
      top,
      panelWidth: measurements.panelWidth,
      panelHeight: measurements.panelHeight,
      triggerRect,
    };
    const signature = JSON.stringify({
      placement: next.placement,
      left: next.left,
      top: next.top,
      panelWidth: next.panelWidth,
      panelHeight: next.panelHeight,
      triggerRect: {
        top: triggerRect.top,
        left: triggerRect.left,
        width: triggerRect.width,
        height: triggerRect.height,
      },
    });
    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;
    setPosition(next);
  }, [gap, margin, panelRef, placements, triggerRef]);

  const schedulePositionUpdate = useCallback(() => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!open) {
      lastSignatureRef.current = null;
      return;
    }
    updatePosition();
    const panel = panelRef.current;
    const observer =
      panel !== null && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => schedulePositionUpdate())
        : null;
    observer?.observe(panel as Element);
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [open, panelRef, schedulePositionUpdate, updatePosition]);

  return { position, scheduleUpdate: schedulePositionUpdate };
}
