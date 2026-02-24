interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white border border-stone-200 rounded-xl shadow-sm dark:bg-stone-900 dark:border-stone-800 ${className}`}>
      {children}
    </div>
  );
}
