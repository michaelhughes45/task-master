import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Weekly review" };

// The header reads the session, so this page blocks like the layout does.
export const instant = false;

// Placeholder until the weekly review page (spec 20).
export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Weekly review" />
      <ComingSoon />
    </>
  );
}
