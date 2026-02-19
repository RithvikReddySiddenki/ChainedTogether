import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    const baseStyles = 'w-full px-3 py-2 border rounded-md transition-colors';
    const stateStyles = error
      ? 'border-[hsl(var(--error))] focus:ring-2 focus:ring-[hsl(var(--error))]/20'
      : 'border-[hsl(var(--border))] focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent))]/20';
    const disabledStyles = 'disabled:opacity-50 disabled:cursor-not-allowed';

    return (
      <input
        ref={ref}
        className={`${baseStyles} ${stateStyles} ${disabledStyles} outline-none ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
