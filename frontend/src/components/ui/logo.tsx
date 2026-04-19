import { cn } from "@/lib/utils";

interface LogoProps {
  showWordmark?: boolean;
  size?: number;
  className?: string;
}

export function Logo({ showWordmark = true, size = 28, className }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <img src="/coin.svg" width={size} height={size} alt="" aria-hidden className="shrink-0" />
      {showWordmark && (
        <span
          className="font-semibold tracking-tight text-stone-900 dark:text-stone-100"
          style={{ fontSize: size * 0.55 }}
        >
          Denarius
        </span>
      )}
    </div>
  );
}
