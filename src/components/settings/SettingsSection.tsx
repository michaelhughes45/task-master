interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const id = `settings-${title.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-lg border bg-card">
      <h2 id={id} className="px-4 pt-3.5 pb-3 text-[15px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
