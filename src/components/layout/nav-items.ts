import {
  CalendarDays,
  ChartNoAxesColumn,
  ListChecks,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  // Shorter label for the phone tab bar
  tabLabel: string;
  // Where the phone tab goes, when it differs from href (still matched against href)
  tabHref?: string;
  icon: LucideIcon;
  // Settings lives behind the header avatar on phones, not in the tab bar
  inTabs: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today", tabLabel: "Today", icon: Sun, inTabs: true },
  {
    href: "/calendar",
    label: "Calendar",
    tabLabel: "Calendar",
    // Phones open the day view directly; a bare /calendar on a phone switches on the client.
    tabHref: "/calendar?view=day",
    icon: CalendarDays,
    inTabs: true,
  },
  { href: "/todos", label: "To-dos", tabLabel: "To-dos", icon: ListChecks, inTabs: true },
  { href: "/review", label: "Weekly review", tabLabel: "Review", icon: ChartNoAxesColumn, inTabs: true },
  { href: "/settings", label: "Settings", tabLabel: "Settings", icon: SlidersHorizontal, inTabs: false },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
