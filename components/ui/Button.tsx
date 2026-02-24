import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ children, variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "px-4 py-2 text-sm rounded-xl font-medium transition-all duration-150 disabled:opacity-50 cursor-pointer active:scale-[0.97]";
  const variants = {
    primary: "bg-amber-600 text-white hover:bg-amber-700 shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600",
    secondary: "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 shadow-sm dark:bg-stone-700 dark:text-stone-200 dark:border-stone-600 dark:hover:bg-stone-600",
    ghost: "text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm dark:bg-red-500 dark:hover:bg-red-400",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
