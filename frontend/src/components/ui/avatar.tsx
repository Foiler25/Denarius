import * as RadixAvatar from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, initials } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex items-center justify-center overflow-hidden align-middle select-none rounded-full bg-[var(--ea-accent)] text-[var(--ea-accent-contrast)] font-semibold",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[10px]",
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-14 w-14 text-base",
        xl: "h-20 w-20 text-lg",
      },
      ring: {
        none: "",
        gold: "ring-2 ring-[var(--ea-accent)] ring-offset-2 ring-offset-white dark:ring-offset-surface-dark",
        online: "ring-2 ring-success ring-offset-2 ring-offset-white dark:ring-offset-surface-dark",
      },
    },
    defaultVariants: { size: "md", ring: "none" },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src?: string | null;
  alt?: string;
  name?: string | null;
  className?: string;
}

export function Avatar({ src, alt, name, size, ring, className }: AvatarProps) {
  return (
    <RadixAvatar.Root className={cn(avatarVariants({ size, ring }), className)}>
      {src && (
        <RadixAvatar.Image
          src={src}
          alt={alt ?? name ?? "Avatar"}
          className="h-full w-full object-cover"
        />
      )}
      <RadixAvatar.Fallback className="flex h-full w-full items-center justify-center uppercase">
        {initials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
