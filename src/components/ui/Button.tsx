import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cx } from "../../lib/cx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: LucideIcon;
};

const VARIANT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-accent-ink shadow-soft hover:shadow-md hover:bg-accent-hover hover:-translate-y-px active:bg-accent-active active:translate-y-0 active:shadow-sm",
  secondary: "border border-border bg-transparent text-text-primary hover:bg-bg-paper-2 hover:border-border-strong",
  ghost: "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
  danger: "bg-danger text-white hover:bg-danger-hover",
};

const SIZE: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        Icon && <Icon size={size === "sm" ? 14 : 16} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
