import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { userInitials } from "@/lib/user-initials";

interface UserAvatarProps {
  name: string;
  email: string;
  className?: string;
}

export function UserAvatar({ name, email, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("size-9", className)} aria-hidden="true">
      <AvatarFallback className="bg-primary-soft text-[13px] font-semibold text-primary-ink">
        {userInitials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
