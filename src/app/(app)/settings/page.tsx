import type { Metadata } from "next";
import { headers } from "next/headers";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppearanceSetting } from "@/components/settings/AppearanceSetting";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { ReviewNotifySetting } from "@/components/settings/ReviewNotifySetting";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { TimezoneSetting } from "@/components/settings/TimezoneSetting";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { TIMEZONES } from "@/lib/timezones";

export const metadata: Metadata = { title: "Settings" };

// Reads the session and the user's accounts.
export const instant = false;

// Google-only users have no password to change.
async function hasPassword() {
  const accounts = await auth.api.listUserAccounts({ headers: await headers() });
  return accounts.some((account) => account.providerId === "credential");
}

export default async function SettingsPage() {
  const user = await requireUser();
  const canChangePassword = await hasPassword();
  // Keep a saved zone selectable even if this runtime's list leaves it out (e.g. "UTC").
  const timezones =
    user.timezone && !TIMEZONES.includes(user.timezone) ? [user.timezone, ...TIMEZONES] : TIMEZONES;

  return (
    <>
      <PageHeader kicker="Settings" title="Preferences" />
      <div className="flex max-w-[680px] flex-col gap-6 px-4 py-6 md:px-8">
        <SettingsSection title="Preferences">
          <SettingsRow label="Appearance" description="Light, dark or match your device">
            <AppearanceSetting />
          </SettingsRow>
          <SettingsRow
            label="Timezone"
            description={'Used for "today", your week and reminders'}
            htmlFor="timezone"
          >
            <TimezoneSetting id="timezone" timezone={user.timezone ?? null} timezones={timezones} />
          </SettingsRow>
          <SettingsRow label="Week" description="Weeks run Monday to Sunday">
            <span className="text-sm text-muted-foreground">Monday start</span>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            label="Sunday review reminder"
            description="A notification on Sundays at 7:00 PM. On iPhone, add Task Master to your Home Screen first."
          >
            <ReviewNotifySetting enabled={user.reviewNotify ?? true} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Account">
          <SettingsRow label="Email" description={user.email}>
            <div className="flex flex-wrap gap-2">
              {canChangePassword && <ChangePasswordDialog email={user.email} />}
              <SignOutButton />
            </div>
          </SettingsRow>
        </SettingsSection>
      </div>
    </>
  );
}
