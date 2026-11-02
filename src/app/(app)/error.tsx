"use client";

import { CircleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// A signed-in page failed to load. The sidebar and tab bar stay, so the user can retry or go elsewhere.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex w-full max-w-[1240px] flex-col items-start gap-4 px-4 py-10 md:px-8">
      <CircleAlert aria-hidden="true" className="size-8 text-warning" />
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.015em]">This page didn&apos;t load</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong on our side. Your tasks and events are safe. Try again in a moment.
        </p>
      </div>
      <Button size="lg" className="h-11 px-4 md:h-9" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
