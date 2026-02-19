import { ButtonHTMLAttributes } from "react";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

const baseButtonClass =
  "inline-flex items-center justify-center rounded-md border border-white/15 bg-[#31556d] px-2.5 py-1 text-xs font-semibold text-[#e8f2f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-150 ease-out hover:not-disabled:bg-[#3d6985] disabled:cursor-not-allowed disabled:opacity-45";

const activeButtonClass = "border-white/45 bg-[#f0f7fc] text-[#1f3e51]";

export function AppButton({
  active = false,
  className = "",
  ...props
}: AppButtonProps) {
  const composedClass = `${baseButtonClass} ${active ? activeButtonClass : ""} ${className}`.trim();
  return <button {...props} className={composedClass} />;
}
