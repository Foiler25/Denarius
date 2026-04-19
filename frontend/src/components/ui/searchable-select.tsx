import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (val: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  placement: "below" | "above";
}

const ESTIMATED_DROPDOWN_HEIGHT = 280;
const VIEWPORT_PADDING = 8;

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [pos, setPos] = React.useState<DropdownPosition | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const displayValue = value && value !== "none" ? selectedLabel : undefined;

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Group items
  const grouped: { group: string | undefined; items: SearchableSelectOption[] }[] = [];
  for (const item of filtered) {
    const last = grouped[grouped.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      grouped.push({ group: item.group, items: [item] });
    }
  }

  function handleSelect(val: string) {
    onValueChange(val);
    setOpen(false);
    setSearch("");
  }

  // Close on click outside (trigger + portaled dropdown both excluded)
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus search input when opened
  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Compute and track portal position. Flips above the trigger when the
  // dropdown wouldn't fit below the viewport (and there's more space above).
  React.useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
      const spaceAbove = rect.top - VIEWPORT_PADDING;
      const placement: "below" | "above" =
        spaceBelow >= ESTIMATED_DROPDOWN_HEIGHT || spaceBelow >= spaceAbove ? "below" : "above";
      setPos({
        top: placement === "below" ? rect.bottom + 4 : rect.top - 4,
        left: rect.left,
        width: rect.width,
        placement,
      });
    };
    update();
    // Track scrolling/resizing of any ancestor so the dropdown follows the trigger
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
          "focus:outline-none focus:border-ring",
          open && "border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !displayValue && "text-muted-foreground",
          className,
        )}
      >
        <span className="truncate">{displayValue ?? placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={dropdownRef}
            // pointerEvents: 'auto' overrides the body lock that Radix Dialog
            // (via react-remove-scroll) installs when a modal is open —
            // without this, our portaled dropdown is click-through.
            // stopPropagation on pointer/mouse-down keeps Radix Dialog's
            // onPointerDownOutside from firing and closing the parent dialog
            // when the user picks an option.
            style={{
              position: "fixed",
              top: pos.placement === "below" ? pos.top : undefined,
              bottom: pos.placement === "above" ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              width: pos.width,
              zIndex: 100,
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="rounded-md border bg-popover text-popover-foreground shadow-md"
          >
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div style={{ maxHeight: 200, overflowY: "auto" }} className="p-1">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No results.</div>
              ) : (
                grouped.map(({ group, items }, gi) => (
                  <div key={gi}>
                    {group && (
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {group}
                      </div>
                    )}
                    {items.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleSelect(item.value)}
                        className={cn(
                          "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                          "hover:bg-accent hover:text-accent-foreground",
                          item.value === value && "bg-accent text-accent-foreground",
                        )}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            item.value === value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
