import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, className = '', children }: CardProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {title && (
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
}
