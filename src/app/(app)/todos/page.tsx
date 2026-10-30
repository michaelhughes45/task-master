import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "To-dos" };

// The header reads the session, so this page blocks like the layout does.
export const instant = false;

// Placeholder until the to-dos page (spec 09).
export default function TodosPage() {
  return (
    <>
      <PageHeader title="To-dos" />
      <ComingSoon />
    </>
  );
}
