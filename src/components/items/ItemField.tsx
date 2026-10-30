import { cn } from "@/lib/utils";

interface ItemFieldProps {
  id: string;
  label: string;
  errors?: string[];
  className?: string;
  children: React.ReactNode;
}

// Native date, time and select controls are styled like the shadcn input; 44px tall on phones.
export const ITEM_INPUT_CLASS =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:h-10 md:text-[14.5px] dark:scheme-dark";

// Wires a control to its error message; spread onto the input whose id is passed to ItemField.
export function fieldA11y(id: string, errors?: string[]) {
  return errors?.[0] ? { id, "aria-invalid": true, "aria-describedby": `${id}-error` } : { id };
}

export function ItemField({ id, label, errors, className, children }: ItemFieldProps) {
  const error = errors?.[0];
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
