"use client";

import { useSyncExternalStore } from "react";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsSection } from "@/components/settings/SettingsSection";

type Platform = "installed" | "ios" | "other";

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getPlatform(): Platform {
  // navigator.standalone is iOS Safari's own flag for a Home Screen app
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (window.matchMedia(STANDALONE_QUERY).matches || iosStandalone) return "installed";
  // iPadOS reports itself as a Mac, so also check for touch
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

// Unknown until hydration, so an installed app never flashes the row.
const getServerPlatform = () => null;

const INSTRUCTIONS: Record<Exclude<Platform, "installed">, string> = {
  ios: "In Safari, tap Share, then Add to Home Screen. Task Master then opens like an app, and can show the Sunday review notification.",
  other:
    "In Chrome or Edge, use the install button at the right of the address bar (or Add to Home screen in the browser menu on Android). Task Master then opens in its own window.",
};

// Hidden when already running as an installed app.
export function InstallApp() {
  const platform = useSyncExternalStore(subscribe, getPlatform, getServerPlatform);
  if (platform === null || platform === "installed") return null;

  return (
    <SettingsSection title="App">
      <SettingsRow label="Install app" description={INSTRUCTIONS[platform]} />
    </SettingsSection>
  );
}
