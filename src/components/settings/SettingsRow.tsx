interface SettingsRowProps {
  label: string;
  description: React.ReactNode;
  // Set when the control is a single input, so the label names it
  htmlFor?: string;
  children: React.ReactNode;
}

export function SettingsRow({ label, description, htmlFor, children }: SettingsRowProps) {
  const Label = htmlFor ? "label" : "div";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t px-4 py-3.5">
      <Label htmlFor={htmlFor} className="min-w-0 flex-1 basis-56">
        <span className="block font-medium">{label}</span>
        <span className="block text-[13px] text-muted-foreground">{description}</span>
      </Label>
      {children}
    </div>
  );
}
