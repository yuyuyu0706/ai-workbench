import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('renders primary by default with type button', () => {
    render(<Button>Save trail</Button>);

    const button = screen.getByRole('button', { name: 'Save trail' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('pt-button', 'pt-button--primary');
  });

  it('respects secondary variant and explicit native props', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Button
        aria-label="Submit prompt"
        className="custom-action"
        data-testid="submit-button"
        onClick={handleClick}
        type="submit"
        variant="secondary"
      />,
    );

    const button = screen.getByTestId('submit-button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-label', 'Submit prompt');
    expect(button).toHaveClass(
      'pt-button',
      'pt-button--secondary',
      'custom-action',
    );

    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled native button behavior', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Button disabled onClick={handleClick}>
        Disabled action
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Disabled action' });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('can receive keyboard focus for focus-visible styling', async () => {
    const user = userEvent.setup();

    render(<Button>Focusable action</Button>);

    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Focusable action' }),
    ).toHaveFocus();
  });
});
