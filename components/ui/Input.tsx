import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ className = "", hasError = false, ...props }: InputProps) {
  const stateClasses = hasError
    ? "border-red-400 focus:ring-red-400 focus:border-red-400 dark:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400"
    : "border-stone-300 focus:ring-amber-500 focus:border-amber-500 dark:border-stone-700 dark:focus:ring-amber-400 dark:focus:border-amber-400";
  return (
    <input
      className={`w-full min-w-0 px-3 py-2 border rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 transition-shadow dark:bg-stone-900 dark:text-stone-100 dark:placeholder-stone-500 ${stateClasses} ${className}`}
      {...props}
    />
  );
}
