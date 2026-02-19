import { HTMLAttributes } from 'react';

interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const Divider = ({ orientation = 'horizontal', className = '', ...props }: DividerProps) => {
  if (orientation === 'vertical') {
    return <div className={`w-px bg-[hsl(var(--border))] ${className}`} {...props} />;
  }

  return <hr className={`border-0 border-t border-[hsl(var(--border))] ${className}`} {...props} />;
};
