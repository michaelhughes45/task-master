"use client";

import { ChevronsUpDown, LogOut, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/layout/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/hooks/use-sign-out";

interface UserMenuProps {
  name: string;
  email: string;
}

export function UserMenu({ name, email }: UserMenuProps) {
  const { isPending, signOut } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className="flex h-12 w-full items-center gap-2.5 rounded-md px-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
      >
        <UserAvatar name={name} email={email} className="size-8" />
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-9" render={<Link href="/settings" />}>
          <SlidersHorizontal aria-hidden="true" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="h-9" disabled={isPending} onClick={signOut}>
          <LogOut aria-hidden="true" />
          {isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
