import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-semibold">Task Master</h1>
        <p className="mt-2 text-muted-foreground">
          Project setup is working. Check the fonts and colors in both themes.
        </p>
        <p className="mt-1 font-mono text-sm text-muted-foreground">09:30 · 3 / 5 done</p>
        <div className="mt-6 flex items-center gap-3">
          <Button size="lg">Add task</Button>
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}
