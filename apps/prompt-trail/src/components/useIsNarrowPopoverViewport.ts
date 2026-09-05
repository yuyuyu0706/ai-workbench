import { useSyncExternalStore } from 'react';

/**
 * Matches the narrow-screen breakpoint below which Trail Detail / Prompt
 * Library popovers switch from an arrow-anchored popover to a full-width
 * bottom sheet (see `ResponsivePopover`).
 */
const NARROW_VIEWPORT_QUERY = '(max-width: 479px)';

function subscribeToNarrowViewport(onChange: () => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => {};
  }
  const mediaQueryList = window.matchMedia(NARROW_VIEWPORT_QUERY);
  // Safari < 14 only supports the legacy addListener/removeListener pair.
  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', onChange);
    return () => mediaQueryList.removeEventListener('change', onChange);
  }
  mediaQueryList.addListener(onChange);
  return () => mediaQueryList.removeListener(onChange);
}

function getNarrowViewportSnapshot(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
}

function getNarrowViewportServerSnapshot(): boolean {
  return false;
}

/**
 * Reactively reports whether the viewport currently matches the narrow
 * (`<480px`) breakpoint that switches popovers to a bottom-sheet layout.
 * Backed by `matchMedia` via `useSyncExternalStore` so it updates on resize
 * without polling.
 */
export function useIsNarrowPopoverViewport(): boolean {
  return useSyncExternalStore(
    subscribeToNarrowViewport,
    getNarrowViewportSnapshot,
    getNarrowViewportServerSnapshot,
  );
}
