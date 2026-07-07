import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  className,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = ['pt-button', `pt-button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return <button className={classes} type={type} {...props} />;
}
