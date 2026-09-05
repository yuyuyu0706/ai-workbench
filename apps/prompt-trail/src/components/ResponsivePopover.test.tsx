import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResponsivePopover } from './ResponsivePopover';
import type { PopoverPlacementOption } from './usePopoverPosition';

const PLACEMENTS: readonly PopoverPlacementOption<'bottom-start'>[] = [
  {
    id: 'bottom-start',
    fits: () => true,
    place: () => ({ left: 0, top: 0 }),
  },
];

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: '(max-width: 479px)',
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
}

function TestHarness({ onClose }: { onClose: () => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button">
        trigger
      </button>
      <ResponsivePopover
        triggerRef={triggerRef}
        panelRef={panelRef}
        open
        placements={PLACEMENTS}
        arrow={{
          varPrefix: '--pt-test-arrow',
          sizePx: 12,
          safeMarginPx: 16,
          className: 'pt-test-popover__arrow',
        }}
        panelClassName="pt-test-popover"
        ariaLabel="テストPopover"
        title="テストPopover"
        onClose={onClose}
      >
        <p>popover body</p>
      </ResponsivePopover>
    </>
  );
}

describe('ResponsivePopover', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the wide-mode arrow popover unchanged when the viewport is not narrow', () => {
    mockMatchMedia(false);
    render(<TestHarness onClose={() => {}} />);

    const dialog = screen.getByRole('dialog', { name: 'テストPopover' });
    expect(dialog).toHaveClass('pt-test-popover');
    expect(dialog.querySelector('.pt-test-popover__arrow')).not.toBeNull();
    expect(document.querySelector('.pt-responsive-popover__scrim')).toBeNull();
    expect(document.querySelector('.pt-responsive-popover--sheet')).toBeNull();
  });

  it('renders a bottom sheet with a scrim and no arrow on narrow viewports', () => {
    mockMatchMedia(true);
    render(<TestHarness onClose={() => {}} />);

    const dialog = screen.getByRole('dialog', { name: 'テストPopover' });
    expect(dialog).toHaveClass('pt-responsive-popover--sheet');
    expect(dialog.querySelector('.pt-test-popover__arrow')).toBeNull();
    expect(screen.getByText('テストPopover')).toBeInTheDocument();
    expect(
      document.querySelector('.pt-responsive-popover__scrim'),
    ).not.toBeNull();
  });

  it('closes the sheet when the scrim is clicked', async () => {
    mockMatchMedia(true);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TestHarness onClose={onClose} />);

    const scrim = document.querySelector('.pt-responsive-popover__scrim');
    expect(scrim).not.toBeNull();
    await user.click(scrim as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sheet on Escape', async () => {
    mockMatchMedia(true);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TestHarness onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sheet via its own close button', async () => {
    mockMatchMedia(true);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TestHarness onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits its own header when sheetHeader is false, avoiding a duplicate heading', () => {
    mockMatchMedia(true);
    function Harness() {
      const triggerRef = useRef<HTMLButtonElement>(null);
      const panelRef = useRef<HTMLDivElement>(null);
      return (
        <ResponsivePopover
          triggerRef={triggerRef}
          panelRef={panelRef}
          open
          placements={PLACEMENTS}
          arrow={{
            varPrefix: '--pt-test-arrow',
            sizePx: 12,
            safeMarginPx: 16,
            className: 'pt-test-popover__arrow',
          }}
          panelClassName="pt-test-popover"
          ariaLabel="テストPopover"
          title="テストPopover"
          sheetHeader={false}
          onClose={() => {}}
        >
          <header>
            <h3>独自の見出し</h3>
          </header>
        </ResponsivePopover>
      );
    }
    render(<Harness />);

    expect(screen.getByText('独自の見出し')).toBeInTheDocument();
    expect(screen.queryByText('テストPopover')).toBeNull();
  });
});
