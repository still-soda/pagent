"use client";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 overflow-visible rounded-full transition-colors duration-200 ${
        checked ? "bg-primary" : "bg-line-strong"
      }`}
    >
      <span
        className="absolute top-0.5 left-0.5 size-5 rounded-full bg-knob shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200"
        style={{
          transform: checked ? "translateX(16px)" : "translateX(0)",
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      />
    </button>
  );
}
