import { ItemDialogsProvider } from "@/components/items/ItemDialogsProvider";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { Fab } from "@/components/layout/Fab";
import { TimezoneSync } from "@/components/layout/TimezoneSync";
import { resolveTimezone, todayIn } from "@/lib/dates";
import { getWeekProgress } from "@/lib/db/progress";
import { requireUser } from "@/lib/session";

// Blocks on the session read so signed-out users are redirected before anything renders.
export const instant = false;

// The real auth boundary for signed-in pages; the proxy only redirects early.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const tz = resolveTimezone(user);
  const weekProgress = await getWeekProgress(user.id, todayIn(tz), tz);

  return (
    <ItemDialogsProvider timezone={tz}>
      <div className="flex flex-1">
        <AppSidebar name={user.name} email={user.email} weekProgress={weekProgress} />
        {/* On phones, bottom padding keeps content clear of the tab bar and the + button. */}
        <main className="flex min-w-0 flex-1 flex-col pb-[calc(160px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
        <Fab />
        <BottomTabs />
        {!user.timezone && <TimezoneSync />}
      </div>
    </ItemDialogsProvider>
  );
}
