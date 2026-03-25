import React from "react";
import { tokens } from "@/lib/design-tokens";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card = ({ children, className = "", noPadding = false }: CardProps) => {
  return (
    <div
      className={`rounded-2xl ${
        !noPadding ? "p-8" : ""
      } overflow-hidden transition-all duration-300 hover:shadow-xl ${className}`}
      style={{
        backgroundColor: tokens.colors.surface_lowest,
        boxShadow: tokens.effects.ambient_shadow,
        border: tokens.effects.ghost_border,
      }}
    >
      {children}
    </div>
  );
};
