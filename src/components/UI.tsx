import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hapticFeedback() {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(10);
  }
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-accent text-accent-dark hover:brightness-110',
      secondary: 'bg-zinc-800 text-white hover:bg-zinc-700',
      outline: 'border border-white/10 text-white hover:bg-white/5',
      ghost: 'text-zinc-400 hover:text-accent transition-colors',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        onClick={(e) => {
          hapticFeedback();
          props.onClick?.(e);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

export function Card({ title, subtitle, poster, children, className, swipeOverlay, ...props }: any) {
  return (
    <div className={cn("sleek-card overflow-hidden group relative", className)} {...props}>
      {swipeOverlay && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {swipeOverlay}
        </div>
      )}
      {poster && (
        <div className="aspect-[2/3] overflow-hidden relative">
          <img 
            src={poster} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-90" />
        </div>
      )}
      <div className="p-5 relative z-10 transition-transform duration-300">
        {title && <h3 className="font-bold text-xl text-white line-clamp-1 group-hover:text-accent transition-colors tracking-tight">{title}</h3>}
        {subtitle && <p className="text-zinc-500 text-sm mb-3 font-medium">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children, subtitle, action }: any) {
  return (
    <div className="flex items-end justify-between mb-6 px-4 md:px-0">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">{children}</h2>
        {subtitle && <p className="text-zinc-500 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
