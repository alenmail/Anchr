import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff, RadioTower } from "lucide-react";
import Chat from "@/components/Chat";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { useUpdater } from "@/hooks/useUpdater";
import { loadConfig } from "@/lib/config";
import { desktop } from "@/lib/desktop";
import FirstLaunchGuide from "@/components/FirstLaunchGuide";
import { qk } from "@/lib/queryKeys";
import { ActiveSessionProvider } from "@/providers/ActiveSessionProvider";
import { ExplorerReferenceProvider } from "@/providers/ExplorerReferenceProvider";
import { OpenCodeClientProvider } from "@/providers/OpenCodeClientProvider";
import { PreferencesProvider } from "@/providers/PreferencesProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { StudioTargetProvider } from "@/providers/StudioTargetProvider";
import logo from "@/assets/anchr-logo.webp";

function AppInner() {
  useUpdater();
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: qk.config, queryFn: loadConfig });
  const [pinned, setPinned] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => { void desktop.getPinnedState().then(setPinned).catch(() => undefined); }, []);
  async function togglePin() {
    if (pending) return;
    setPending(true);
    try {
      const applied = await desktop.setPinnedState(!pinned);
      setPinned(applied);
      await queryClient.invalidateQueries({queryKey: qk.config});
      toast.success(applied ? "Anchr stays above other windows" : "Anchr is no longer pinned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change pin setting");
    } finally { setPending(false); }
  }
  return (
    <main className="flex h-full flex-col overflow-hidden">
      <div className="app-titlebar flex h-10 shrink-0 items-center justify-between border-b border-sky-500/10 bg-[#0b111b] px-3">
        <div className="flex items-center gap-2 text-[11px] tracking-wide text-slate-300">
          <img src={logo} alt="" className="h-6 w-6 rounded-[7px]" />
          <span className="font-semibold tracking-[.13em]">ANCHR</span>
          <span className="mx-2 hidden h-3 w-px bg-slate-700 sm:inline-block" />
          <span className="hidden items-center gap-1 text-[10px] text-slate-500 sm:flex">
            <RadioTower size={12} /> Studio bridge
          </span>
        </div>
        <button type="button" onClick={() => void togglePin()} disabled={pending} title={pinned ? "Unpin from screen" : "Pin to screen (always on top)"}
          aria-label={pinned ? "Unpin from screen" : "Pin to screen"} aria-pressed={pinned}
          className={`app-no-drag inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${pinned ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-slate-700/70 bg-slate-800/40 text-slate-300 hover:border-sky-500/40 hover:text-white"}`}>
          {pinned ? <Pin size={13} fill="currentColor" /> : <PinOff size={13} />}
          {pinned ? "Pinned" : "Pin to screen"}
        </button>
      </div>
      <ErrorBoundary><Chat /></ErrorBoundary>
      {config && !config.onboardingCompleted && <FirstLaunchGuide onFinish={async () => { await desktop.patchConfig({onboardingCompleted: true}); await queryClient.invalidateQueries({queryKey: qk.config}); }} />}
      <Toaster />
    </main>
  );
}
function App() {
  const activeSessionIdRef = useRef<string | null>(null);
  return (
    <QueryProvider><ThemeProvider><OpenCodeClientProvider activeSessionIdRef={activeSessionIdRef}>
      <ActiveSessionProvider activeSessionIdRef={activeSessionIdRef}><PreferencesProvider>
        <StudioTargetProvider><ExplorerReferenceProvider><AppInner /></ExplorerReferenceProvider></StudioTargetProvider>
      </PreferencesProvider></ActiveSessionProvider>
    </OpenCodeClientProvider></ThemeProvider></QueryProvider>
  );
}
export default App;
