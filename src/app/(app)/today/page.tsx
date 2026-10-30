import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Today" };

// The header reads the session, so this page blocks like the layout does.
export const instant = false;

// Placeholder until the real Today page (spec 18).
export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" />
      <ComingSoon />
    </>
  );
}
