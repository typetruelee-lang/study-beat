import type { ButtonHTMLAttributes } from 'react';
import { Button as TdsButton, type ButtonProps as TdsButtonProps } from '@toss/tds-mobile';
import { IS_WEB_SKIN } from '../../app/skin';
import './common.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  block?: boolean;
}

/**
 * App button. Toss build: primary/secondary are TDS buttons (fill / weak), ghost stays a quiet
 * text button. Web build: the skin's own button.
 */
export function ClayButton({ variant = 'secondary', size = 'md', block, className = '', ...rest }: Props) {
  if (!IS_WEB_SKIN && variant !== 'ghost') {
    return (
      <TdsButton
        type="button"
        color="primary"
        variant={variant === 'primary' ? 'fill' : 'weak'}
        size={size === 'lg' ? 'xlarge' : 'large'}
        display={block ? 'block' : 'inline'}
        className={`tds-btn ${className}`}
        {...(rest as unknown as TdsButtonProps)}
      />
    );
  }
  const cls = ['cbtn', `cbtn--${variant}`, size === 'lg' && 'cbtn--lg', block && 'cbtn--block', className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} {...rest} />;
}

export function IconButton({ className = '', flat, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { flat?: boolean }) {
  return <button type="button" className={`icon-btn ${flat ? 'icon-btn--flat' : ''} ${className}`} {...rest} />;
}
