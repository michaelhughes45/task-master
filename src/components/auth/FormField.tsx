import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends React.ComponentProps<"input"> {
  name: string;
  label: string;
  errors?: string[];
  // Shown at the right of the label row, e.g. "Forgot password?"
  labelAction?: React.ReactNode;
}

export function FormField({ name, label, errors, labelAction, ...inputProps }: FormFieldProps) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const error = errors?.[0];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id} className="text-[13.5px]">
          {label}
        </Label>
        {labelAction}
      </div>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-11 rounded-md bg-background px-3 text-base md:text-[15px] dark:bg-background"
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
