import { useId } from "react";
import { ItemField, fieldA11y } from "@/components/items/ItemField";
import { Input } from "@/components/ui/input";

export interface TitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  // The dialog focuses it on open.
  inputRef: React.Ref<HTMLInputElement>;
  placeholder: string;
  errors?: string[];
}

export function TitleField({ value, onChange, inputRef, placeholder, errors }: TitleFieldProps) {
  const id = useId();
  return (
    <ItemField id={id} label="Title" errors={errors}>
      <Input
        ref={inputRef}
        type="text"
        required
        maxLength={200}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md bg-background px-3 text-base md:text-[15px] dark:bg-background"
        {...fieldA11y(id, errors)}
      />
    </ItemField>
  );
}
