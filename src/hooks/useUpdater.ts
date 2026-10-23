import { useEffect } from "react";
import { toast } from "sonner";
import { desktop } from "@/lib/desktop";

// Inform only. Never download or install an update without the user's click.
let checkedThisLaunch = false;
export function useUpdater(): void {
  useEffect(() => {
    if (checkedThisLaunch) return;
    checkedThisLaunch = true;
    const timer = window.setTimeout(() => {
      void desktop.checkForUpdate().then(update => {
        if (!update) return;
        toast(`Anchr ${update.version} is available`, {
          description: "Open Settings → About to review and install the update.",
          duration: 9000,
        });
      }).catch(() => undefined);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, []);
}
