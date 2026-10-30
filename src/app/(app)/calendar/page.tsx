import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Calendar" };

// The header reads the session, so this page blocks like the layout does.
export const instant = false;

// Placeholder until the calendar views (specs 13–14).
export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" />
      <ComingSoon />
    </>
  );
}
