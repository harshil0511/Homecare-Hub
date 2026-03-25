import React from "react";
import { tokens } from "@/lib/design-tokens";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "info";
  className?: string;
}

export const Badge = ({ children, variant = "info", className = "" }: BadgeProps) => {
  const variants = {
    success: `bg-emerald-50 text-emerald-700 border-emerald-100`,
    warning: `bg-amber-50 text-amber-700 border-amber-100`,
    error: `bg-rose-50 text-rose-700 border-rose-100`,
    info: `bg-blue-50 text-blue-700 border-blue-100`,
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
