import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ children, variant = "primary", className = "", ...props }: ButtonProps) {
  const base = "px-4 py-2 text-sm rounded-md font-medium transition-colors disabled:opacity-50 cursor-pointer";
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    ghost: "text-gray-600 hover:text-black",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
