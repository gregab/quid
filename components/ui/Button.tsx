import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ children, variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "px-4 py-2 text-sm rounded-lg font-medium transition-all duration-150 disabled:opacity-50 cursor-pointer active:scale-[0.97]";
  const variants = {
    primary: "bg-stone-800 text-white hover:bg-stone-700 shadow-sm dark:bg-stone-600 dark:hover:bg-stone-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600",
    ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm dark:bg-red-500 dark:hover:bg-red-400",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
