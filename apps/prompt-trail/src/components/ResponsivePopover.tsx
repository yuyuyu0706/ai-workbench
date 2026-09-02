import {
  useEffect,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { buildPopoverArrowStyle } from './popoverArrow';
import { useIsNarrowPopoverViewport } from './useIsNarrowPopoverViewport';
import {
  usePopoverPosition,
  type PopoverPlacementOption,
} from './usePopoverPosition';

export type ResponsivePopoverArrowConfig = {
  /** CSS custom-property prefix (including leading `--`) for arrow offsets. */
  readonly varPrefix: string;
  readonly sizePx: number;
  readonly safeMarginPx: number;
  /** Class name applied to the arrow `<span>` in wide (arrow-popover) mode. */
  readonly className: string;
};

export type ResponsivePopoverProps<TId extends string> = {
  readonly open: boolean;
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly placements: readonly PopoverPlacementOption<TId>[];
  readonly gap?: number;
  readonly margin?: number;
  /** Arrow styling used in wide mode; omitted entirely in narrow (sheet) mode. */
  readonly arrow: ResponsivePopoverArrowConfig;
  /** Class name(s) for the wide-mode arrow-popover panel `<div>`. */
  readonly panelClassName: string;
  /** Optional wrapper class applied around `children` in wide mode only. */
  readonly scrollClassName?: string;
  readonly panelId?: string;
  /**
   * Accessible name for the wide-mode dialog. Pass `undefined` to leave the
   * wide-mode panel exactly as it is today (no `aria-label`); the narrow
   * (sheet) dialog always uses `title` as its accessible name.
   */
  readonly ariaLabel?: string;
  /** Heading shown in the narrow bottom-sheet header, for context. */
  readonly title: string;
  /**
   * Whether ResponsivePopover renders its own sheet header (title + close
   * button) in narrow mode. Set to `false` when `children` already render
   * their own header/close affordance, to avoid a duplicate header.
   * Defaults to `true`.
   */
  readonly sheetHeader?: boolean;
  /**
   * Closes the popover. Wired to the sheet's close button, scrim click, and
   * Escape key in narrow mode. Wide mode keeps relying on each caller's
   * existing outside-click/Escape handling, unchanged.
   */
  readonly onClose: () => void;
  /**
   * Exposes the underlying `usePopoverPosition` `scheduleUpdate` so callers
   * that need to force a reposition after a content change (e.g. an inline
   * confirmation appearing) outside of resize/scroll can call it.
   */
  readonly scheduleUpdateRef?: MutableRefObject<(() => void) | null>;
  readonly children: ReactNode;
};

/**
 * Renders one of Trail Detail / Prompt Library's popovers, switching between
 * two layouts depending on viewport width:
 *
 * - Wide (`>=480px`): the existing arrow-anchored popover, portaled to
 *   `document.body` and positioned via `usePopoverPosition`. Pixel-for-pixel
 *   identical to the popovers' previous bespoke implementations.
 * - Narrow (`<480px`): a full-width bottom sheet with a scrim behind it, no
 *   arrow, and (optionally) its own header showing `title` for context.
 *
 * `children` are the popover's content and are rendered unchanged in both
 * modes.
 */
export function ResponsivePopover<TId extends string>({
  open,
  triggerRef,
  panelRef,
  placements,
  gap,
  margin,
  arrow,
  panelClassName,
  scrollClassName,
  panelId,
  ariaLabel,
  title,
  sheetHeader = true,
  onClose,
  scheduleUpdateRef,
  children,
}: ResponsivePopoverProps<TId>) {
  const isNarrow = useIsNarrowPopoverViewport();
  const { position, scheduleUpdate } = usePopoverPosition({
    triggerRef,
    panelRef,
    // Narrow mode doesn't use the computed position, so skip the work (and
    // its resize/scroll listeners) entirely while it's active.
    open: open && !isNarrow,
    placements,
    margin,
    gap,
  });

  useEffect(() => {
    if (scheduleUpdateRef) scheduleUpdateRef.current = scheduleUpdate;
  }, [scheduleUpdate, scheduleUpdateRef]);

  useEffect(() => {
    if (!open || !isNarrow) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isNarrow, onClose]);

  if (!open) return null;

  if (isNarrow) {
    return createPortal(
      <>
        <div
          aria-hidden="true"
          className="pt-responsive-popover__scrim"
          onClick={onClose}
        />
        <div
          className="pt-responsive-popover pt-responsive-popover--sheet"
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={title}
        >
          {sheetHeader ? (
            <header className="pt-responsive-popover__header">
              <h3>{title}</h3>
              <button
                aria-label="閉じる"
                className="pt-responsive-popover__close"
                onClick={onClose}
                type="button"
              >
                ×
              </button>
            </header>
          ) : null}
          <div className="pt-responsive-popover__body">{children}</div>
        </div>
      </>,
      document.body,
    );
  }

  const style: CSSProperties =
    position === null
      ? { left: 0, top: 0, visibility: 'hidden' }
      : {
          left: position.left,
          top: position.top,
          ...buildPopoverArrowStyle(position, {
            varPrefix: arrow.varPrefix,
            arrowSizePx: arrow.sizePx,
            safeMarginPx: arrow.safeMarginPx,
          }),
        };

  return createPortal(
    <div
      ref={panelRef}
      className={panelClassName}
      data-placement={position?.placement}
      id={panelId}
      role="dialog"
      aria-label={ariaLabel}
      style={style}
    >
      <span aria-hidden="true" className={arrow.className} />
      {scrollClassName ? (
        <div className={scrollClassName}>{children}</div>
      ) : (
        children
      )}
    </div>,
    document.body,
  );
}
