import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ModeratorStatus } from "@/hooks/useModeratorAvailability";

interface ModeratorStatusToggleProps {
  status: ModeratorStatus;
  onStatusChange: (status: ModeratorStatus) => void;
}

const statusConfig: Record<ModeratorStatus, { label: string; color: string }> = {
  online: { label: "Online", color: "text-green-500" },
  busy: { label: "Busy", color: "text-amber-500" },
  offline: { label: "Offline", color: "text-muted-foreground" },
};

export const ModeratorStatusToggle = ({ status, onStatusChange }: ModeratorStatusToggleProps) => {
  const config = statusConfig[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
          <Circle className={cn("w-2.5 h-2.5 fill-current", config.color)} />
          {config.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(statusConfig) as ModeratorStatus[]).map((s) => (
          <DropdownMenuItem key={s} onClick={() => onStatusChange(s)} className="gap-2 text-xs">
            <Circle className={cn("w-2.5 h-2.5 fill-current", statusConfig[s].color)} />
            {statusConfig[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
