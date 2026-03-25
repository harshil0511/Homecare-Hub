import React from "react";
import { tokens } from "@/lib/design-tokens";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, className = "", ...props }: InputProps) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </label>
      )}
      <input
        className={`w-full border-b-2 border-transparent px-4 py-4 text-sm font-bold outline-none transition-all placeholder:text-slate-300 focus:border-emerald-900 ${
          error ? "border-rose-500" : ""
        } ${className}`}
        style={{
          backgroundColor: tokens.colors.surface_low,
          color: tokens.colors.on_surface,
        }}
        {...props}
      />
      {error && (
        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight italic">
          {error}
        </p>
      )}
    </div>
  );
};
