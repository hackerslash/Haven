import { cx } from "../../lib/cx";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

export function Switch({ checked, onChange, disabled, "aria-label": ariaLabel }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent" : "border border-border-strong bg-bg-tertiary",
      )}
    >
      <span
        className={cx(
          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
