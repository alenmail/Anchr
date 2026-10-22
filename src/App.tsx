import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff, RadioTower } from "lucide-react";
import Chat from "@/components/Chat";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { useUpdater } from "@/hooks/useUpdater";
import { loadConfig, patchConfig } from "@/lib/config";
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
  const pinned = config?.pinnedToScreen ?? false;
  async function togglePin() {
    await patchConfig({ pinnedToScreen: !pinned });
    await queryClient.invalidateQueries({ queryKey: qk.config });
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
        <button type="button" onClick={() => void togglePin()} title={pinned ? "Unpin from screen" : "Pin to screen (always on top)"}
          aria-label={pinned ? "Unpin from screen" : "Pin to screen"} aria-pressed={pinned}
          className={`app-no-drag inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${pinned ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-slate-700/70 bg-slate-800/40 text-slate-300 hover:border-sky-500/40 hover:text-white"}`}>
          {pinned ? <Pin size={13} fill="currentColor" /> : <PinOff size={13} />}
          {pinned ? "Pinned" : "Pin to screen"}
        </button>
      </div>
      <ErrorBoundary><Chat /></ErrorBoundary>
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
