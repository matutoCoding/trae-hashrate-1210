import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leading, trailing, className, id, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <div
          className={cn(
            "relative flex items-center rounded-md border border-ink-200 bg-white focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500 transition",
            error && "border-warning-red focus-within:ring-warning-red/20 focus-within:border-warning-red"
          )}
        >
          {leading && (
            <span className="pl-3 text-ink-400 flex items-center">{leading}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-400",
              leading && "pl-2",
              trailing && "pr-2"
            )}
            {...props}
          />
          {trailing && (
            <span className="pr-3 text-ink-400 flex items-center">{trailing}</span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-warning-red">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-md border border-ink-200 bg-white",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
            "placeholder:text-ink-400 transition resize-y min-h-[88px]",
            error && "border-warning-red focus:ring-warning-red/20 focus:border-warning-red",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-warning-red">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, children, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-md border border-ink-200 bg-white",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition appearance-none pr-9",
            "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2020%2020%22%3E%3Cpath%20stroke=%22%2364748B%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20stroke-width=%221.5%22%20d=%22M6%208l4%204%204-4%22/%3E%3C/svg%3E')] bg-[length:1.25rem_1.25rem] bg-no-repeat bg-[right_0.5rem_center]",
            error && "border-warning-red",
            className
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        {error && <p className="mt-1 text-xs text-warning-red">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
