import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, className = '', children }: CardProps) {
  return (
    <div className={`glass-card p-6 animate-fade-in ${className}`}>
      {title && (
        <div className="mb-5">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          <div
            className="mt-2 h-0.5 w-12 rounded-full"
            style={{ background: 'var(--gradient-brand)' }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
