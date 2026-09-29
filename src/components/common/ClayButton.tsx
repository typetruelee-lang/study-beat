import type { ButtonHTMLAttributes } from 'react';
import './common.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  block?: boolean;
}

export function ClayButton({ variant = 'secondary', size = 'md', block, className = '', ...rest }: Props) {
  const cls = ['cbtn', `cbtn--${variant}`, size === 'lg' && 'cbtn--lg', block && 'cbtn--block', className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} {...rest} />;
}

export function IconButton({ className = '', flat, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { flat?: boolean }) {
  return <button type="button" className={`icon-btn ${flat ? 'icon-btn--flat' : ''} ${className}`} {...rest} />;
}
