import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { DesktopSidebar, DESKTOP_SIDEBAR_WIDTH_CLASS } from "./DesktopSidebar";
import { ConnectivityIndicator } from "@/components/connectivity/ConnectivityIndicator";
import { ProfilePopover } from "@/components/layout/ProfilePopover";
import { useNotifications } from "@/hooks/useNotifications";

export const ShellCard = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={`rounded-2xl border border-border/70 bg-card p-5 ${className}`}>{children}</div>
);

export const ShellCardTitle = ({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) => (
  <div className="mb-4 flex items-center justify-between gap-2">
    <h2 className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {title}
    </h2>
    {action}
  </div>
);

interface AppShellProps {
  /** Small uppercase kicker above the title */
  eyebrow?: string;
  title: string;
  /** Optional muted line under the title */
  subtitle?: string;
  /** Optional back target rendered before the title */
  backTo?: { to: string; label: string };
  /** Buttons/controls rendered at the right of the header, before global controls */
  actions?: ReactNode;
  /** Right rail content (rendered ≥xl). Pass fragments of ShellCard elements. */
  rail?: ReactNode;
  /** Keep the same page content on mobile while showing the full shell on desktop. */
  responsive?: boolean;
  /** Existing page header shown only below the desktop breakpoint. */
  mobileHeader?: ReactNode;
  children: ReactNode;
  /** Skip the standard max-width container (used by full-height layouts like Trade) */
  fullWidth?: boolean;
}

/**
 * Shared Facebook-style desktop application shell:
 * persistent left nav + sticky top bar + workspace + optional right rail.
 * Rendered hidden below md so pages keep their untouched mobile layout.
 */
export const AppShell = ({
  eyebrow,
  title,
  subtitle,
  backTo,
  actions,
  rail,
  responsive = false,
  mobileHeader,
  children,
  fullWidth = false,
}: AppShellProps) => {
  const { unreadCount } = useNotifications();

  return (
    <div className={responsive ? "min-h-screen bg-background" : "hidden min-h-screen bg-background md:block"}>
      <DesktopSidebar />
      <div className={`flex min-h-screen flex-col ${responsive ? "md:ml-60" : DESKTOP_SIDEBAR_WIDTH_CLASS}`}>
        <header className={`${responsive ? "hidden md:block " : ""}sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl`}>
          <div className="flex min-h-16 items-center justify-between gap-5 px-6 py-3 xl:px-10">
            <div className="flex min-w-0 items-center gap-4">
              {backTo && (
                <Link
                  to={backTo.to}
                  className="shrink-0 rounded-xl border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  ← {backTo.label}
                </Link>
              )}
              <div className="min-w-0">
                {eyebrow && (
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
                )}
                <h1 className="truncate text-xl font-semibold">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {actions}
              <ConnectivityIndicator />
              <Link to="/notifications" className="relative">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <Bell className="h-4 w-4" />
                </span>
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Link>
              <ProfilePopover />
            </div>
          </div>
        </header>
        <main className={`flex-1 ${responsive ? "px-0 py-0 md:px-6 md:py-6 xl:px-10" : "px-6 py-6 xl:px-10"}`}>
          <div className={`mx-auto ${fullWidth ? "max-w-none h-full" : "max-w-[1600px]"}`}>
            {responsive && mobileHeader && <div className="md:hidden">{mobileHeader}</div>}
            {rail ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0">{children}</div>
                <aside className="hidden space-y-5 xl:col-span-1 xl:block">{rail}</aside>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
