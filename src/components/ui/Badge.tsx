import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export const Badge = ({ variant = 'default', className = '', children, ...props }: BadgeProps) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const variants = {
    default: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    success: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
    warning: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
    error: 'bg-[hsl(var(--error))]/10 text-[hsl(var(--error))]',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
