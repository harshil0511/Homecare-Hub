"use client";

import React from "react";
import { tokens } from "@/lib/design-tokens";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variantStyles: Record<string, { className: string; style: React.CSSProperties }> = {
  primary: {
    className: "text-white shadow-lg hover:brightness-110",
    style: { backgroundColor: tokens.colors.primary_container },
  },
  secondary: {
    className: "hover:brightness-95",
    style: {
      backgroundColor: tokens.colors.surface_low,
      color: tokens.colors.primary_container,
    },
  },
  outline: {
    className: "border-2 hover:text-white",
    style: {
      borderColor: tokens.colors.primary_container,
      color: tokens.colors.primary_container,
    },
  },
  ghost: {
    className: "",
    style: { color: tokens.colors.primary_container },
  },
};

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  isLoading,
  className = "",
  disabled,
  style,
  ...props
}: ButtonProps) => {
  const baseStyles = "inline-flex items-center justify-center font-black uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

  const sizes = {
    sm: "px-4 py-2 text-[10px] rounded-lg",
    md: "px-8 py-4 text-xs rounded-2xl",
    lg: "px-10 py-5 text-sm rounded-2xl",
  };

  const v = variantStyles[variant];

  return (
    <button
      className={`${baseStyles} ${v.className} ${sizes[size]} ${className}`}
      style={{ ...v.style, ...style }}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
};
